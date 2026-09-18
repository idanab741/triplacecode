-- ========================================================================
-- Migration 0061: לינק הזמנה אישי + מעקב "מי הזמין את מי"
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- משדרג את פיצ'ר "הזמן חברים" מ-UI בלבד למנגנון אמיתי:
--
-- 1. invite_code - קוד קצר וייחודי לכל משתמש (7 תווים, בלי אותיות/ספרות
--    מבלבלות כמו 0/O/1/I), נוצר אוטומטית לכל פרופיל חדש (ר' generate_invite_code
--    למטה + ברירת המחדל על העמודה - handle_new_user ב-0001/0003 לא צריך
--    להשתנות, כי insert into profiles (id) כבר מפעיל את ברירת המחדל).
--    זה מה שהופך את /join/<code> ללינק אישי אמיתי במקום קישור כללי לעמוד הבית.
--
-- 2. referred_by - שומר את הקשר "מי הזמין את מי" לתמיד (nullable, נקבע
--    פעם אחת בלבד). זו התשתית המינימלית שמאפשרת בעתיד להעניק למזמין את
--    100 הטריפים על חבר שנרשם - בלי לבנות עכשיו שום מערכת תגמולים/נקודות.
--
-- 3. redeem_invite(code) - הפונקציה היחידה שכותבת ל-referred_by. security
--    definer + auth.uid() (כמו handle_new_user ב-0001) כדי שמשתמש מחובר
--    יוכל "לפדות" קוד של מישהו אחר בלי RLS ציבורי שהיה חושף את כל טבלת
--    profiles. מגנה בעצמה מפני הזמנה עצמית ומפני שינוי referred_by אחרי
--    שכבר נקבע (עדכון רק כש-referred_by is null).

-- --------------------------------------------------------------------
-- generate_invite_code(): מחפש קוד פנוי בלולאה - התנגשות כמעט בלתי
-- אפשרית עם 7 תווים מתוך 32 אפשרויות (32^7 ≈ 34 מיליארד צירופים),
-- אבל הלולאה מבטיחה ייחודיות גם במקרה הנדיר.
-- --------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  i int;
begin
  loop
    new_code := '';
    for i in 1..7 loop
      new_code := new_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = new_code);
  end loop;
  return new_code;
end;
$$;

alter table public.profiles
  add column if not exists invite_code text,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

-- מילוי חד-פעמי למשתמשים קיימים שנרשמו לפני המיגרציה הזו
update public.profiles
set invite_code = public.generate_invite_code()
where invite_code is null;

alter table public.profiles
  alter column invite_code set default public.generate_invite_code(),
  alter column invite_code set not null;

create unique index if not exists profiles_invite_code_idx on public.profiles (invite_code);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

comment on column public.profiles.invite_code is
  'קוד ההזמנה האישי והייחודי של המשתמש. הלינק הציבורי הוא /join/<invite_code>. נוצר אוטומטית לכל פרופיל חדש.';
comment on column public.profiles.referred_by is
  'ה-id של המשתמש שהזמין את המשתמש הזה (אם הצטרף דרך לינק הזמנה אישי). נקבע פעם אחת בלבד, דרך redeem_invite().';

-- --------------------------------------------------------------------
-- redeem_invite(p_code): נקראת ע"י המשתמש המוזמן אחרי הרשמה/התחברות,
-- עם קוד ההזמנה שנשמר בדפדפן שלו. מחזירה true רק אם הקישור בפועל בין
-- המזמין למוזמן נקבע כרגע (ולא ניסיון חוזר/קוד לא תקין/הזמנה עצמית).
-- --------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  referrer_id uuid;
  rows_updated int;
begin
  if auth.uid() is null or p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;

  select id into referrer_id from public.profiles where invite_code = upper(trim(p_code));

  if referrer_id is null or referrer_id = auth.uid() then
    return false;
  end if;

  update public.profiles
  set referred_by = referrer_id
  where id = auth.uid() and referred_by is null;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated, anon;
