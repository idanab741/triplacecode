-- ========================================================================
-- Migration 0083: קישור פוסט למקום TripAdd (לא לטבלת places הישנה)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תוספת (בקשה מפורשת - "כשמוסיפים אטרקציה בעמוד הבית, שזה יופיע
-- גם כפוסט ב-place's"): posts.place_id הקיים מוגבל ב-FK ל-places
-- הישנה בלבד (ר' migration 0068) - אי אפשר לשים בו tripadd_submissions.id
-- (אותה בעיה בדיוק שכבר תיקנו ב-favorites.place_type, migration 0080 -
-- כאן הפתרון המקביל: עמודה נפרדת, לא דריסת המשמעות של הישנה).
-- ========================================================================

alter table public.posts
  add column tripadd_submission_id uuid references public.tripadd_submissions (id) on delete set null;

create index posts_tripadd_submission_id_idx on public.posts (tripadd_submission_id) where tripadd_submission_id is not null;

comment on column public.posts.tripadd_submission_id is
  'מקום TripAdd שהפוסט הזה משתף (ר' AddPlaceModal.tsx - צ''קבוקס "שיתוף ב-place''s") - נפרד מ-place_id הישן.';
