-- ========================================================================
-- Migration 0074: place_submissions - חיבור ל-Google Place ID
--
-- מאפשר: (א) לזהות אם המקום שהוצע כבר קיים ב-places (google_place_id
-- ייחודי כבר על places, ר' 0004), (ב) למלא אוטומטית עיר/כתובת/קואורדינטות
-- מגוגל בלי שהמשתמש יקליד אותם ידנית (בקשה מפורשת).
-- ========================================================================

alter table public.place_submissions
  add column if not exists google_place_id text,
  add column if not exists google_photo_url text;

create index if not exists place_submissions_google_place_id_idx on public.place_submissions (google_place_id);

comment on column public.place_submissions.google_place_id is 'Google Place ID - למניעת כפילויות (בדיקה מול places.google_place_id) ולמילוי אוטומטי של כתובת/קואורדינטות';
