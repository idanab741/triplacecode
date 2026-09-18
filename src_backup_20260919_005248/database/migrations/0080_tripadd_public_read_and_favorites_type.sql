-- ========================================================================
-- Migration 0080: תיקון RLS ל-tripadd_submissions + סוג "tripadd" חדש
-- ב-favorites, כדי ש"כמה שמרו" יעבוד נכון על עמוד אטרקציה.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תיקון-שורש (Bug שנמצא תוך כדי בניית עמוד האטרקציה של TripAdd):
-- ה-policy היחיד שהוגדר ב-migration 0078 על tripadd_submissions היה
-- "using (auth.uid() = submitted_by)" - כל משתמש רואה אך ורק את
-- ה-submissions שהוא עצמו הוסיף. זה חסם בפועל את כל התכלית של הפיצ'ר
-- (מפה קהילתית משותפת - "תעשה שיופיע ישר על המפה" התכוון לכל
-- המשתמשים, לא רק ליוצר): כל קריאה דרך הלקוח הרגיל (anon key + RLS,
-- ר' /api/tripadd/pins/route.ts) הייתה בפועל מסננת בשקט לפי
-- auth.uid() - כל משתמש "רואה" רק את המקומות שלו, לא של הקהילה.
-- הפתרון: policy נוסף, פתוח לכל משתמש מחובר, בלי סינון לפי
-- submitted_by - "לא מסונן ע\"י status" נשאר כמו שהיה (ר' ההערה
-- ב-0078/pins route - סינון לפי סטטוס מתוכנן בעתיד דרך ADMIN, לא כאן).
-- ========================================================================

drop policy if exists "Users can view their own tripadd submissions" on public.tripadd_submissions;

create policy "Authenticated users can view all tripadd submissions"
  on public.tripadd_submissions for select
  to authenticated
  using (true);

comment on policy "Authenticated users can view all tripadd submissions" on public.tripadd_submissions is
  'מחליף את ה-policy הקודם (auth.uid() = submitted_by בלבד) - המפה/החיפוש/עמוד האטרקציה קהילתיים, לא אישיים. מחליף לגמרי, לא מוסיף על, את ה-policy הקודם.';

-- *** תוספת (בקשה מפורשת - "כמה שמרו את האטרקציה בעמוד שלהם", לא
-- לייקים/דיסלייקים בסגנון TripMatch): favorites.place_type הוגבל
-- עד עכשיו ל-('place', 'destination') בלבד (ר' migration 0006) -
-- tripadd_submissions הוא מקור דאטה שלישי, נפרד, שצריך ערך משלו כדי
-- לא "להתחזות" לשורה בטבלת places (ר' ההערה הקיימת כבר ב-
-- HomeMapPlacePopupContent.tsx על "favorites יתומים").
alter table public.favorites
  drop constraint if exists favorites_place_type_check;

alter table public.favorites
  add constraint favorites_place_type_check
  check (place_type in ('place', 'destination', 'tripadd'));
