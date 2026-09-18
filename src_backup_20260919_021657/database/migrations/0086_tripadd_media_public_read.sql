-- ========================================================================
-- Migration 0086: תיקון RLS על tripadd_submission_media - אותה בעיה
-- בדיוק כמו tripadd_submissions לפני migration 0080 (בקשה מפורשת -
-- מסמך העדכון, סעיף 10: "משתמש A מעלה תמונה, משתמש B לא רואה אותה")
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** תיקון-שורש: ה-policy היחיד שהוגדר ב-migration 0078 על
-- tripadd_submission_media היה "submitted_by = auth.uid()" - בדיוק
-- אותה טעות שתוקנה כבר על tripadd_submissions עצמה. שתי תוצאות:
-- 1) SELECT: משתמש B פותח מקום שמשתמש A יצר - כל שורות ה-media
--    נחסמות בשקט (הן "שייכות" ל-A, לא ל-B) - זו הסיבה שהתמונה לא
--    מוצגת בכלל למי שלא יצר את המקום.
-- 2) INSERT: משתמש שמוסיף ביקורת (לא הוא היוצר המקורי) על מקום קיים
--    ומצרף תמונות - upsertTripAddReview נכשל בשקט על ה-INSERT הזה
--    (הבדיקה "submitted_by = auth.uid()" נכשלת, כי המבקר לא ה-submitted_by).
-- ========================================================================

drop policy if exists "Users can view media of their own tripadd submissions" on public.tripadd_submission_media;
drop policy if exists "Users can attach media to their own tripadd submissions" on public.tripadd_submission_media;

create policy "Authenticated users can view all tripadd submission media"
  on public.tripadd_submission_media for select
  to authenticated
  using (true);

-- כל משתמש מחובר יכול לצרף מדיה לכל submission - כולל כזה שלא הוא
-- יצר (בדיוק המקרה של הוספת תמונות לביקורת על מקום קיים, ר'
-- upsertTripAddReview ב-tripAddService.ts). לא צריך להוכיח בעלות על
-- ה-submission, רק בעלות על media_id עצמו (media_assets.owner_id -
-- זה כבר נאכף בנפרד ב-RLS של media_assets, לא כאן).
create policy "Authenticated users can attach media to any tripadd submission"
  on public.tripadd_submission_media for insert
  to authenticated
  with check (true);

comment on policy "Authenticated users can view all tripadd submission media" on public.tripadd_submission_media is
  'מחליף policy קודם שהגביל SELECT ליוצר ה-submission בלבד - תמונות TripAdd הן ציבוריות/משותפות בעיצוב, כמו tripadd_submissions עצמה (migration 0080).';
