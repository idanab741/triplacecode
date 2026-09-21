-- ========================================================================
-- Migration 0092: place's — שם משתמש: שינוי פעם בחודש (30 יום)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- profiles.username_changed_at = מתי שונה שם המשתמש לאחרונה. trigger מונע שינוי נוסף בתוך 30 יום
-- (הגנה ב-DB, בנוסף לבדיקה בשירות - כך שגם קריאה ישירה ל-API של Supabase לא עוקפת את ההגבלה).
--  - הגדרה ראשונה (מ-NULL, כולל ה-username האוטומטי user_xxxxxx בכניסה הראשונה) - לא נספרת כשינוי.
--  - כל שינוי מערך קיים לערך אחר נספר, ומתחיל 30 יום נעילה.
--  - בלי משתמש מחובר (service_role / SQL Editor / אדמין) - פטור מההגבלה ולא מתחיל נעילה.
--  - משתמש רגיל לא יכול לאפס את username_changed_at כדי לעקוף (הטריגר מחזיר אותה לערך הקודם).
-- ========================================================================

alter table public.profiles add column if not exists username_changed_at timestamptz;

create or replace function public.enforce_username_change_limit()
returns trigger
language plpgsql
as $$
begin
  -- בלי משתמש מחובר (auth.uid() IS NULL: service_role, SQL Editor, כלי אדמין) - פטור מההגבלה, והכול עובר כמו שהוא.
  if auth.uid() is null then
    return new;
  end if;

  if new.username is distinct from old.username and old.username is not null then
    if old.username_changed_at is not null and old.username_changed_at > now() - interval '30 days' then
      raise exception 'אפשר לשנות שם משתמש פעם בחודש - השינוי הבא אפשרי ב-%',
        to_char(old.username_changed_at + interval '30 days', 'DD/MM/YYYY')
        using errcode = 'P0001';
    end if;
    new.username_changed_at := now();
  else
    -- משתמש רגיל לא יכול לאפס/לשנות את username_changed_at ידנית כדי לעקוף את ההגבלה: רק הטריגר קובע אותה.
    new.username_changed_at := old.username_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_username_change_limit on public.profiles;
-- גם על עדכון username_changed_at עצמו (בלי זה אפשר היה לאפס אותה ולעקוף את הנעילה)
create trigger profiles_username_change_limit
  before update of username, username_changed_at on public.profiles
  for each row execute function public.enforce_username_change_limit();

comment on column public.profiles.username_changed_at is 'מתי שונה ה-username לאחרונה (שינוי אפשרי פעם ב-30 יום). NULL = מעולם לא שונה.';
