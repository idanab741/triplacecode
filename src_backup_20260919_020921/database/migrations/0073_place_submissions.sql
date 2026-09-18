-- ========================================================================
-- Migration 0073: place_submissions - הצעת מקום חדש ע"י משתמש
--
-- לא הופך ישירות ל-place אמיתי (סעיף 35 - "לא ליצור Place רשמי ישירות
-- ללא moderation"). status='pending' עד אישור Admin. אישור בפועל (יצירת
-- שורה תואמת בטבלת places, סעיף 36) הוא צעד נפרד/עתידי בממשק Admin -
-- כאן בונים את חלק ההגשה (המשתמש), שהוא הפיצ'ר המבוקש כרגע.
-- ========================================================================

create table public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  website text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  -- אם אושר בפועל, הקישור למקום האמיתי שנוצר (סעיף 36 - אינטגרציה מלאה)
  approved_place_id uuid references public.places (id) on delete set null,
  constraint place_submissions_category_check
    check (category in ('restaurant', 'attraction', 'nature', 'nightlife', 'hotel')),
  constraint place_submissions_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index place_submissions_submitted_by_idx on public.place_submissions (submitted_by);
create index place_submissions_status_idx on public.place_submissions (status);

alter table public.place_submissions enable row level security;

create policy "Users can view their own submissions"
  on public.place_submissions for select
  using (auth.uid() = submitted_by);

create policy "Users can submit a place as themselves"
  on public.place_submissions for insert
  with check (auth.uid() = submitted_by);

comment on table public.place_submissions is 'הצעת מקום חדש ע''י משתמש (סעיף 34) - pending עד לאישור Admin, שרק אז יוצר שורה אמיתית ב-places (סעיף 35-36)';


create table public.place_submission_media (
  submission_id uuid not null references public.place_submissions (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (submission_id, media_id)
);

alter table public.place_submission_media enable row level security;

create policy "Users can view media of their own submissions"
  on public.place_submission_media for select
  using (
    exists (select 1 from public.place_submissions where id = place_submission_media.submission_id and submitted_by = auth.uid())
  );

create policy "Users can attach media to their own submissions"
  on public.place_submission_media for insert
  with check (
    exists (select 1 from public.place_submissions where id = place_submission_media.submission_id and submitted_by = auth.uid())
  );
