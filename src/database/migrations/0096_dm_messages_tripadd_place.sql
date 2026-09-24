-- ========================================================================
-- Migration 0096: שליחת מקום בצ'אט - גם מקומות שהועלו ע"י משתמשים (tripadd)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- (דורש שמיגרציות 0078 - tripadd_submissions, 0093 - dm_messages - כבר רצו)
--
-- עד עכשיו dm_messages.place_id הפנה רק ל-places, ולכן מקום מ-tripadd_submissions
-- לא היה אפשר לשלוח לחבר ("אי אפשר לשתף את המקום הזה"). עכשיו הודעה מסוג 'place'
-- מפנה לבדיוק אחד מהשניים: place_id (places) או tripadd_id (tripadd_submissions).
-- ========================================================================

alter table public.dm_messages
  add column if not exists tripadd_id uuid references public.tripadd_submissions (id) on delete set null;

alter table public.dm_messages drop constraint if exists dm_messages_kind_matches_ref;

alter table public.dm_messages add constraint dm_messages_kind_matches_ref check (
  (kind = 'text' and text is not null and trip_id is null and place_id is null and tripadd_id is null and post_id is null and review_id is null)
  or (kind = 'trip' and trip_id is not null and place_id is null and tripadd_id is null and post_id is null and review_id is null)
  or (kind = 'place' and ((place_id is not null and tripadd_id is null) or (place_id is null and tripadd_id is not null))
      and trip_id is null and post_id is null and review_id is null)
  or (kind = 'post' and post_id is not null and trip_id is null and place_id is null and tripadd_id is null and review_id is null)
  or (kind = 'review' and review_id is not null and trip_id is null and place_id is null and tripadd_id is null and post_id is null)
);

comment on column public.dm_messages.tripadd_id is
  'kind=place: מקום שהועלה ע"י משתמש (tripadd_submissions). בדיוק אחד מ-place_id / tripadd_id מלא.';
