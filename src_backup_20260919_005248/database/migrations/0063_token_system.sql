-- ========================================================================
-- Migration 0063: מערכת "טריפים" (Tokens) - מכסה חודשית + ledger + RPCs אטומיים
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- ארכיטקטורה:
--
-- - user_token_balances: מקור האמת היחיד ליתרה הנוכחית (balance) ולתחילת
--   המחזור הפעיל (cycle_start = היום הראשון של החודש הקלנדרי הרלוונטי).
--   אין rollover - reset תמיד ל-100, לא הוספה.
--
-- - token_transactions: ledger - שורה נפרדת לכל שינוי (חיוב/זיכוי), לא
--   JSON מאוחד. amount שלילי = צריכה (למשל -20 עבור trippy_ai_generation),
--   חיובי = זיכוי/החזר. reference_id ייחודי (UNIQUE) - זו ההגנה המרכזית
--   מפני חיוב כפול (double click / retry / request כפול): ניסיון חיוב
--   שני עם אותו reference_id בדיוק פשוט לא יוצר שורה נוספת (ר' consume_tokens
--   למטה - בודק לפני שהוא מנסה להכניס).
--
-- - כל שלוש הפונקציות (ensure_token_cycle/consume_tokens/refund_tokens)
--   הן security definer ו-*אינן* נגישות ל-anon/authenticated בכלל (ר'
--   revoke/grant בסוף הקובץ) - הן מקבלות p_user_id כפרמטר מפורש, ולכן
--   חייבות להיקרא רק דרך שרת מהימן (createAdminClient, service_role)
--   שכבר אימת בעצמו מי המשתמש המחובר (auth.getUser()) לפני הקריאה -
--   בדיוק כמו כל שאר ה-admin API הקיים. לעולם לא ייחשפו ללקוח ישירות.
--
-- - consume_tokens עצמו מבצע הכל בטרנזקציה אחת: איפוס מחזור אם צריך +
--   בדיקת אידמפוטנטיות + UPDATE אטומי עם WHERE balance >= amount +
--   הכנסת שורת ledger - כך ששתי קריאות במקביל על אותו user_id נחסמות
--   ע"י row-level locking של Postgres על ה-UPDATE (לא race condition
--   ברמת JS/API - זו ההגנה האמיתית מפני overspending).

create table public.user_token_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance int not null default 100 check (balance >= 0),
  cycle_start date not null default date_trunc('month', now())::date,
  updated_at timestamptz not null default now()
);

create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null, -- שלילי = צריכה, חיובי = זיכוי/החזר
  type text not null, -- 'trippy_ai_generation' | 'tripmatch_like' | 'refund' | 'bonus' | 'manual_adjustment' וכו'
  reference_id text unique, -- מפתח אידמפוטנטיות - ר' הסבר למעלה. null מותר (למשל adjustment ידני עתידי בלי מקור אחד-חד-ערכי)
  created_at timestamptz not null default now()
);

create index token_transactions_user_id_idx on public.token_transactions (user_id);
create index token_transactions_created_at_idx on public.token_transactions (created_at desc);
create index token_transactions_type_idx on public.token_transactions (type);

comment on table public.user_token_balances is
  'יתרת "טריפים" נוכחית + תחילת המחזור החודשי הפעיל. מקור אמת יחיד - נקרא/נכתב אך ורק דרך ensure_token_cycle/consume_tokens/refund_tokens (service_role).';
comment on table public.token_transactions is
  'Ledger מלא של כל שינוי ביתרה (audit - ראו migration 0063 - "כמה נצרך, על מה, מתי"). reference_id ייחודי מונע חיוב כפול על אותה פעולה בדיוק.';

-- ------------------------------------------------------------------------
-- ensure_token_cycle(p_user_id): יוצר שורת יתרה למשתמש חדש (100/100),
-- או מאפס ל-100 אם המחזור השמור ישן מהחודש הקלנדרי הנוכחי. לא נוגע
-- ב-token_transactions (reset הוא לא "צריכה" ולא נרשם ב-ledger).
-- ------------------------------------------------------------------------
create or replace function public.ensure_token_cycle(p_user_id uuid)
returns public.user_token_balances
language plpgsql
security definer set search_path = public
as $$
declare
  current_period date := date_trunc('month', now())::date;
  result public.user_token_balances;
begin
  insert into public.user_token_balances (user_id, balance, cycle_start)
  values (p_user_id, 100, current_period)
  on conflict (user_id) do nothing;

  update public.user_token_balances
  set balance = 100, cycle_start = current_period, updated_at = now()
  where user_id = p_user_id and cycle_start < current_period
  returning * into result;

  if result.user_id is null then
    select * into result from public.user_token_balances where user_id = p_user_id;
  end if;

  return result;
end;
$$;

-- ------------------------------------------------------------------------
-- consume_tokens(p_user_id, p_amount, p_type, p_reference_id): הפונקציה
-- היחידה שמורידה יתרה. אטומית, אידמפוטנטית (reference_id), ומוודאת
-- מחזור עדכני לפני הבדיקה. מחזירה jsonb: {success, alreadyCharged, balance, error?}.
-- ------------------------------------------------------------------------
create or replace function public.consume_tokens(
  p_user_id uuid,
  p_amount int,
  p_type text,
  p_reference_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance_row public.user_token_balances;
  v_existing_tx_id uuid;
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'consume_tokens: p_amount must be positive';
  end if;

  -- אידמפוטנטיות: אם reference_id הזה כבר חויב בעבר (double click/retry/
  -- request כפול), לא לחייב שוב - מחזירים הצלחה "שקטה" עם היתרה הנוכחית.
  if p_reference_id is not null then
    select id into v_existing_tx_id from public.token_transactions where reference_id = p_reference_id limit 1;
    if v_existing_tx_id is not null then
      select * into v_balance_row from public.user_token_balances where user_id = p_user_id;
      return jsonb_build_object('success', true, 'alreadyCharged', true, 'balance', coalesce(v_balance_row.balance, 0));
    end if;
  end if;

  v_balance_row := public.ensure_token_cycle(p_user_id);

  -- ה-UPDATE האטומי עצמו: Postgres נועל את השורה הזו לכל משך הטרנזקציה,
  -- כך ששתי קריאות במקביל על אותו user_id מתבצעות בטור, לא במקביל -
  -- זו ההגנה האמיתית מפני overspending (לא בדיקה נפרדת ברמת השרת/JS).
  update public.user_token_balances
  set balance = balance - p_amount, updated_at = now()
  where user_id = p_user_id and balance >= p_amount
  returning balance into v_new_balance;

  if v_new_balance is null then
    return jsonb_build_object(
      'success', false,
      'alreadyCharged', false,
      'balance', v_balance_row.balance,
      'error', 'INSUFFICIENT_TOKENS'
    );
  end if;

  insert into public.token_transactions (user_id, amount, type, reference_id)
  values (p_user_id, -p_amount, p_type, p_reference_id);

  return jsonb_build_object('success', true, 'alreadyCharged', false, 'balance', v_new_balance);
end;
$$;

-- ------------------------------------------------------------------------
-- refund_tokens(...): פעולת פיצוי (compensating transaction) - נקראת רק
-- כשחיוב הצליח אך הפעולה שהוא מימן נכשלה בפועל אחרי מכן (ר' דרישה
-- מפורשת - "אין לחייב אם הפעולה נכשלה"). p_reference_id כאן שונה
-- מה-reference_id של החיוב המקורי (למשל "<original>:refund") כדי לא
-- להתנגש ב-UNIQUE constraint.
-- ------------------------------------------------------------------------
create or replace function public.refund_tokens(
  p_user_id uuid,
  p_amount int,
  p_type text,
  p_reference_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_balance int;
begin
  if p_amount <= 0 then
    raise exception 'refund_tokens: p_amount must be positive';
  end if;

  update public.user_token_balances
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  insert into public.token_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_amount, p_type, p_reference_id);

  return jsonb_build_object('success', true, 'balance', coalesce(v_new_balance, 0));
end;
$$;

-- ------------------------------------------------------------------------
-- RLS - הגנה כפולה: גם אם מישהו יקרא ל-select ישירות, רואה רק את עצמו.
-- אין policy ל-insert/update/delete בכלל למשתמש רגיל - כל כתיבה עוברת
-- דרך הפונקציות למעלה (service_role, עוקף RLS).
-- ------------------------------------------------------------------------
alter table public.user_token_balances enable row level security;
alter table public.token_transactions enable row level security;

create policy "Users can view their own token balance"
  on public.user_token_balances for select
  using (auth.uid() = user_id);

create policy "Users can view their own token transactions"
  on public.token_transactions for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- הרשאות הרצה: *רק* service_role. אין GRANT ל-anon/authenticated - אחרת
-- כל משתמש מחובר יכול היה לקרוא ל-consume_tokens/refund_tokens עם
-- p_user_id *של מישהו אחר* ולשנות את היתרה שלו ישירות. הפונקציות האלה
-- הן API פנימי לשרת (Next.js API routes עם createAdminClient) בלבד.
-- ------------------------------------------------------------------------
revoke all on function public.ensure_token_cycle(uuid) from public;
revoke all on function public.consume_tokens(uuid, int, text, text) from public;
revoke all on function public.refund_tokens(uuid, int, text, text) from public;

grant execute on function public.ensure_token_cycle(uuid) to service_role;
grant execute on function public.consume_tokens(uuid, int, text, text) to service_role;
grant execute on function public.refund_tokens(uuid, int, text, text) to service_role;
