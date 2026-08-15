-- ========================================================================
-- Migration 0019: user_addresses - כתובות שמורות למיקוד "בחירת מיקום"
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- תוספת בלבד - שום דבר קיים לא נגע.
-- ========================================================================

create table public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  label text not null,              -- לדוגמה: "הבית", "העבודה", או הכתובת עצמה
  address_text text not null,       -- הכתובת המלאה כפי שהוזנה/נבחרה
  city text,
  latitude double precision,
  longitude double precision,

  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_addresses enable row level security;

create policy "Users can view their own addresses"
  on public.user_addresses for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own addresses"
  on public.user_addresses for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own addresses"
  on public.user_addresses for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own addresses"
  on public.user_addresses for delete
  to authenticated
  using (auth.uid() = user_id);

create trigger set_user_addresses_updated_at
  before update on public.user_addresses
  for each row execute function public.set_updated_at();

create index user_addresses_user_id_idx on public.user_addresses (user_id);
