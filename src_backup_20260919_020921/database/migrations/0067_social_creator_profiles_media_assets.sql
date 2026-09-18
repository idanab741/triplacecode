-- ========================================================================
-- Migration 0067: place's — Stage 1 (חלק 2/N)
-- creator_profiles + media_assets
-- ========================================================================

-- ------------------------------------------------------------------------
-- 7. creator_profiles (סעיף 22, 62 באפיון)
-- לא משכפל display name/avatar/bio אם כבר קיימים ב-profiles -
-- creator_profiles מכיל רק שדות ייחודיים ל-Creator.
-- ------------------------------------------------------------------------

create table public.creator_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  category text[] not null default '{}',
  verification_status text not null default 'none',
  cover_media_id uuid, -- FK אל media_assets, מתווסף כ-constraint בהמשך (media_assets נוצרת אחרי)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_verification_check
    check (verification_status in ('none', 'verified'))
);

create index creator_profiles_category_idx on public.creator_profiles using gin (category);

alter table public.creator_profiles enable row level security;

-- creator profiles הם ברירת מחדל Public (סעיף 20) - כל אחד יכול לראות
create policy "Anyone can view creator profiles"
  on public.creator_profiles for select
  using (true);

create policy "Users can create their own creator profile"
  on public.creator_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own creator profile"
  on public.creator_profiles for update
  using (auth.uid() = user_id);

create trigger set_creator_profiles_updated_at
  before update on public.creator_profiles
  for each row execute function public.set_updated_at();

-- טריגר: כשנוצר creator_profiles, לסמן profiles.is_creator = true אוטומטית
-- (כדי לא לשכפל מקור אמת - is_creator ב-profiles הוא הדגל המהיר לשאילתות,
-- creator_profiles הוא הפירוט)
create or replace function public.sync_is_creator_flag()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set is_creator = true where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set is_creator = false where id = old.user_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger sync_is_creator_on_creator_profiles
  after insert or delete on public.creator_profiles
  for each row execute function public.sync_is_creator_flag();

comment on table public.creator_profiles is 'שכבת Creator מעל profiles הקיים - לא משכפל נתוני זהות (סעיף 62)';


-- ------------------------------------------------------------------------
-- 8. media_assets (סעיף 66 באפיון)
-- אחסון קבצים אמיתי (Supabase Storage) - לא Base64 ב-DB
-- ------------------------------------------------------------------------

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  url text not null,
  thumbnail_url text,
  mime_type text not null,
  width integer,
  height integer,
  duration numeric,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint media_assets_type_check check (type in ('image', 'video'))
);

create index media_assets_owner_id_idx on public.media_assets (owner_id);

alter table public.media_assets enable row level security;

-- הרשאות select על media_assets עצמן מוגדרות ברמת visibility של האובייקט
-- שמכיל אותן (post/story/message) ולא ברמת הטבלה עצמה - כאן מאפשרים
-- select לבעלים בלבד כברירת מחדל בטוחה; טבלאות post_media/story_media
-- יטפלו בחשיפה הציבורית דרך joins ב-API/service (DTO), לא ב-RLS ישיר
-- על media_assets, כדי למנוע חשיפת מדיה פרטית (סעיף 82,99).
create policy "Owners can view their own media"
  on public.media_assets for select
  using (auth.uid() = owner_id);

create policy "Users can upload their own media"
  on public.media_assets for insert
  with check (auth.uid() = owner_id);

create policy "Owners can delete their own media"
  on public.media_assets for delete
  using (auth.uid() = owner_id);

comment on table public.media_assets is 'קבצי מדיה (Supabase Storage URLs). SELECT ציבורי נחשף רק דרך ה-API DTO של Post/Story/Message, לא ישירות (הגנה על מדיה פרטית)';

-- כעת ניתן לחבר FK מ-creator_profiles.cover_media_id
alter table public.creator_profiles
  add constraint creator_profiles_cover_media_fk
    foreign key (cover_media_id) references public.media_assets (id) on delete set null;

-- ------------------------------------------------------------------------
-- Storage bucket ל-social media (עקבי עם הדפוס הקיים ב-0002/0008)
-- ------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

create policy "Public can view social media"
  on storage.objects for select
  using (bucket_id = 'social-media');

create policy "Authenticated users can upload their own social media"
  on storage.objects for insert
  with check (
    bucket_id = 'social-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Owners can delete their own social media"
  on storage.objects for delete
  using (
    bucket_id = 'social-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
