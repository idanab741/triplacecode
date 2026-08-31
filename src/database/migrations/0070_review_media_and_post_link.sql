-- ========================================================================
-- Migration 0070: place's — קישור Review חברתי
--
-- לא יוצר טבלת reviews חדשה - place_reviews הקיים (0043) נשאר מקור
-- האמת היחיד לדירוג (rating), בדיוק לפי סעיף 37 באפיון ("אין לשבור
-- מערכות קיימות"). כאן רק מוסיפים: (א) media למי שרוצה לצרף תמונות/
-- וידאו לביקורת, (ב) קישור ל-post חברתי שנוצר יחד עם הביקורת - כדי
-- שהביקורת תופיע ב-Feed/Likes/Comments (סעיף 38 - "Review Integration"),
-- בלי לשכפל את מנגנון הלייקים/תגובות (הם כבר קיימים על posts, 0068).
-- ========================================================================

alter table public.place_reviews
  add column if not exists post_id uuid references public.posts (id) on delete set null;

create index if not exists place_reviews_post_id_idx on public.place_reviews (post_id);

create table public.review_media (
  review_id uuid not null references public.place_reviews (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (review_id, media_id)
);

alter table public.review_media enable row level security;

-- ביקורות ציבוריות (כמו place_reviews עצמו) - כל אחד יכול לראות את המדיה שלהן
create policy "Anyone can view review media"
  on public.review_media for select
  using (true);

create policy "Authors can attach media to their own reviews"
  on public.review_media for insert
  with check (
    exists (select 1 from public.place_reviews where id = review_media.review_id and user_id = auth.uid())
  );

create policy "Authors can remove media from their own reviews"
  on public.review_media for delete
  using (
    exists (select 1 from public.place_reviews where id = review_media.review_id and user_id = auth.uid())
  );

comment on table public.review_media is 'תמונות/וידאו שצורפו לביקורת (place_reviews) - נפרד מ-post_media כי לא כל ביקורת יוצרת post';
