-- ========================================================================
-- Migration 0044: מדיניות DELETE חסרה על trip_builder_stops
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** זה תיקון לבאג אמיתי, לא שינוי ארכיטקטורה: במיגרציה 0013 (שיצרה את
-- הטבלה) הוגדרו מדיניות SELECT/INSERT/UPDATE ל-trip_builder_stops - אבל
-- DELETE נשכח. כש-RLS מופעל וטבלה אין לה מדיניות DELETE בכלל, ה-ברירת
-- מחדל היא לחסום כל מחיקה לגמרי, בשקט - ה-DELETE לא זורק שגיאה, פשוט
-- לא משפיע על אף שורה. זו הייתה בדיוק הסיבה ש"מחיקת תחנה נעלמת לשנייה
-- וחוזרת": העדכון האופטימי בצד הלקוח הראה "נמחק", אבל ה-DELETE בפועל
-- בשרת (trip_builder_stops/[stopId]/instruct route.ts) לא עשה כלום -
-- והבנייה מחדש של המסלול (finalizeItinerary) שאחריו קראה שוב את השורה
-- שעדיין קיימת ב-DB, אז התחנה "חזרה". אותה מדיניות בדיוק כמו UPDATE/
-- SELECT הקיימות - בעלות על ה-session, לא על השורה ישירות. ***
-- ========================================================================

create policy "Users can delete their own trip builder stops"
  on public.trip_builder_stops for delete
  using (exists (
    select 1 from public.trip_builder_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));
