-- ========================================================================
-- Migration 0079: tripadd_submissions - דירוג Google (google_rating) +
-- כמות מדרגים (google_rating_count) לכרטיסיית הפופאפ במפה. "פתוח/סגור
-- עכשיו" מחושב *חי* בצד הלקוח מתוך opening_hours הקיים (ר'
-- utils/openingHours.ts, isPlaceOpenNow) - לא נשמר snapshot נפרד,
-- כדי שלא יתיישן.
--
-- שני הערכים מגיעים ישירות מ-Google Places (rating/userRatingCount) -
-- לא מומצאים.
-- ========================================================================

alter table public.tripadd_submissions
  add column if not exists google_rating numeric(2, 1),
  add column if not exists google_rating_count integer;

comment on column public.tripadd_submissions.google_rating is 'דירוג ממוצע של Google (rating) - לא ממוצע TripAdd, לא מומצא';
comment on column public.tripadd_submissions.google_rating_count is 'כמות המדרגים ב-Google (userRatingCount)';
