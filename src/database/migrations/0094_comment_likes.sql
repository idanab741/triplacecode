-- ========================================================================
-- Migration 0094: לייק על תגובה (comment_likes)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- (דורש שמיגרציה 0068 - comments - כבר רצה)
--
-- לייק על תגובה או על תגובה-לתגובה (אותה טבלת comments, כולל תגובות של
-- פוסטים / חוויות / טיולים). שורה אחת לכל (תגובה, משתמש). ה-RLS מסתמך על
-- ה-RLS של comments: רואים לייקים רק על תגובות שהצופה רשאי לראות.
-- ========================================================================

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index comment_likes_user_id_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

create policy "Users can view likes on comments they can view"
  on public.comment_likes for select
  using (exists (select 1 from public.comments where id = comment_likes.comment_id));

create policy "Users can like comments as themselves"
  on public.comment_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.comments where id = comment_likes.comment_id)
  );

create policy "Users can unlike their own comment likes"
  on public.comment_likes for delete
  using (auth.uid() = user_id);

comment on table public.comment_likes is 'לייק על תגובה (comments) - שורה אחת לכל זוג תגובה+משתמש.';
