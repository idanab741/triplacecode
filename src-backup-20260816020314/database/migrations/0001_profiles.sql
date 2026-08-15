-- ========================================================================
-- Migration 0001: profiles table + RLS + auto-create trigger
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

-- טבלת הפרופיל של כל משתמש
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  city text,
  birth_date date,
  country text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- הפעלת Row Level Security
alter table public.profiles enable row level security;

-- כל משתמש יכול לקרוא רק את השורה של עצמו
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- כל משתמש יכול ליצור רק את השורה של עצמו
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- כל משתמש יכול לעדכן רק את השורה של עצמו
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: יוצר שורת פרופיל ריקה אוטומטית לכל משתמש חדש שנרשם
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: מעדכן את updated_at אוטומטית בכל שינוי בשורה
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- מילוי חד-פעמי: יוצר שורת פרופיל למשתמשים שכבר נרשמו לפני יצירת הטבלה הזו
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
