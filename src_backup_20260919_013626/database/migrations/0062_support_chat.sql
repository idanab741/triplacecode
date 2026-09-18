-- ========================================================================
-- Migration 0062: מערכת צ'אט שירות לקוחות (support_conversations + support_messages)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- ארכיטקטורה:
--
-- - שיחה אחת "לכל החיים" למשתמש (לא נוצרת שיחה חדשה בכל פנייה) - כשמשתמש
--   שולח הודעה ראשונה, המערכת יוצרת conversation; כל הודעה נוספת (גם אחרי
--   שהשיחה נסגרה ע"י Admin) נכנסת לאותה שיחה ומחזירה אותה לפעילות. זה מה
--   שהופך את זה ל-Chat אמיתי עם היסטוריה מלאה, ולא טופס Contact Us חד-פעמי.
--
-- - status מנוהל אוטומטית ע"י טריגר (support_message_after_insert למטה),
--   לא ע"י הקוד בצד השרת - כך שההתנהגות זהה בין אם ההודעה הוכנסה ע"י
--   משתמש (client, RLS-respecting) או ע"י Admin (service_role, עוקף RLS):
--   הודעת user -> waiting_for_admin. הודעת admin -> waiting_for_user.
--   'open' הוא רק ברירת המחדל הרגעית לפני ההודעה הראשונה, ו/או תווית
--   ידנית ש-Admin יכול לבחור מחדש (ר' PATCH /api/admin/support/[id]).
--
-- - כל הודעה היא row נפרד (לא JSON יחיד) - ר' דרישה מפורשת.

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'waiting_for_admin', 'waiting_for_user', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin')),
  -- נשאר null עבור הודעות admin - למנגנון ה-Admin אין משתמשי Supabase
  -- Auth נפרדים לכל נציג (אותו pattern כמו שאר admin API - x-admin-secret
  -- משותף, לא session פר-נציג), אז אין uuid אמיתי להצמיד.
  sender_user_id uuid references auth.users (id) on delete set null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- אינדקסים (ר' דרישה מפורשת - conversation.user_id/status/last_message_at,
-- messages.conversation_id/created_at) + אינדקס חלקי לחישוב "יש הודעות
-- שלא נקראו" מהיר בעמוד הרשימה של ה-Admin.
create index support_conversations_user_id_idx on public.support_conversations (user_id);
create index support_conversations_status_idx on public.support_conversations (status);
create index support_conversations_last_message_at_idx on public.support_conversations (last_message_at desc);
create index support_messages_conversation_id_idx on public.support_messages (conversation_id);
create index support_messages_created_at_idx on public.support_messages (created_at);
create index support_messages_unread_user_idx on public.support_messages (conversation_id) where sender_type = 'user' and read_at is null;

comment on table public.support_conversations is
  'שיחת שירות לקוחות - שיחה אחת קבועה למשתמש, נפתחת מחדש (status) בכל פעם שנשלחת הודעה חדשה. status מנוהל אוטומטית ע"י support_message_after_insert().';
comment on table public.support_messages is
  'הודעה בודדת בתוך שיחת שירות לקוחות - row נפרד לכל הודעה, לא JSON מאוחד.';

-- ------------------------------------------------------------------------
-- טריגר: אחרי כל הכנסת הודעה, מעדכן את השיחה - last_message_at/updated_at
-- וה-status הנגזר מסוג השולח. security definer כדי שזה יעבוד גם כשההודעה
-- הוכנסה ע"י משתמש רגיל (RLS-respecting client, שאין לו הרשאת UPDATE על
-- support_conversations בכלל - ר' RLS למטה) וגם ע"י Admin (service_role).
-- ------------------------------------------------------------------------
create or replace function public.support_message_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.support_conversations
  set
    last_message_at = new.created_at,
    updated_at = now(),
    status = case when new.sender_type = 'user' then 'waiting_for_admin' else 'waiting_for_user' end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row execute function public.support_message_after_insert();

-- ------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

-- USER: יכול לראות/ליצור רק שיחות של עצמו. בכוונה *אין* policy ל-UPDATE -
-- שינוי status נעשה רק ע"י Admin (service_role, עוקף RLS) או ע"י הטריגר
-- למעלה (security definer, גם הוא עוקף RLS) - לא ע"י המשתמש ישירות.
create policy "Users can view their own conversations"
  on public.support_conversations for select
  using (auth.uid() = user_id);

create policy "Users can create their own conversations"
  on public.support_conversations for insert
  with check (auth.uid() = user_id);

-- USER: יכול לראות רק הודעות בתוך שיחות שלו, וליצור הודעה רק כ"user"
-- (לא "admin") ורק בתוך שיחה שהוא הבעלים שלה - מונע התחזות לנציג שירות
-- או כתיבה לתוך שיחה של מישהו אחר.
create policy "Users can view messages in their own conversations"
  on public.support_messages for select
  using (
    exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users can send messages in their own conversations"
  on public.support_messages for insert
  with check (
    sender_type = 'user'
    and sender_user_id = auth.uid()
    and exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- USER: מותר לעדכן (read_at בלבד, ר' /api/support/conversations/[id])
-- הודעות בתוך שיחה שהוא הבעלים שלה - כדי לסמן תשובות Admin כ"נקראו"
-- כשהוא נכנס לצ'אט. מוגבל לשיחות של עצמו בלבד, לא חושף הודעות של אחרים.
create policy "Users can mark messages read in their own conversations"
  on public.support_messages for update
  using (
    exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- ADMIN: אין policy נפרדת - כל גישת Admin עוברת דרך /api/admin/support/*
-- עם createAdminClient() (service_role, עוקף RLS לגמרי), אותו pattern
-- בדיוק כמו שאר ה-admin API הקיים. אין חשיפת service_role ל-client.
