-- *** בקשה מפורשת ("תג ליד השם - האם הוא מאומת או לא", האימות ידני ע"י האדמין):
-- סימון "מאומת" לפרופיל. נקבע רק מהאדמין (service role) - משתמש לא יכול לאמת את עצמו,
-- גם אם יעדכן את השורה שלו ישירות (מדיניות ה-UPDATE של profiles מאפשרת לו לעדכן את השורה שלו).

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

create or replace function public.profiles_protect_is_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- service_role (האדמין / שרת) רשאי לשנות; כל שאר התפקידים - הערך נשמר כמו שהיה.
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified := false;
  else
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_verified on public.profiles;
create trigger profiles_protect_is_verified
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_is_verified();

-- מי שכבר מסומן כיוצר תוכן הציג עד היום וי כחול ליד השם - נשאר מאומת.
update public.profiles set is_verified = true where is_creator = true and is_verified = false;
