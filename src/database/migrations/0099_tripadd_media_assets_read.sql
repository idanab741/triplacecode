-- ========================================================================
-- Migration 0099: קריאה של תמונות/סרטונים של מקומות קהילה (TripAdd) לכל משתמש מחובר
-- (בקשה מפורשת - "בעמוד הבחירות שלי - איפה התמונות של המקומות?")
--
-- *** תיקון-שורש: migration 0086 פתח את tripadd_submission_media לקריאה, אבל על media_assets
-- עצמה נשאר רק "Owners can view their own media" (owner_id = auth.uid()). לכן בשאילתה מהדפדפן
-- (למשל getUnifiedPlace ב"הבחירות שלי") ה-join ל-media_assets מחזיר null לכל תמונה שמשתמש אחר
-- העלה - והמקום מוצג בלי תמונה. תמונות של מקומות קהילה הן תוכן ציבורי בעיצוב (מוצגות בעמוד המקום),
-- אז מאפשרים לקרוא רק את ה-media שמחובר ל-submission כלשהו. שאר ה-media (למשל פרטי) לא נפתח.
-- ביטול: drop policy "Authenticated users can view tripadd media" on public.media_assets;
-- ========================================================================

create policy "Authenticated users can view tripadd media"
  on public.media_assets for select
  to authenticated
  using (
    exists (
      select 1 from public.tripadd_submission_media m
      where m.media_id = media_assets.id
    )
  );
