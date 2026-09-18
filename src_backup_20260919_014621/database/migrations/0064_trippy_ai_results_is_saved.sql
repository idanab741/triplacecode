-- ========================================================================
-- Migration 0064: trippy_ai_results is_saved
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- *** תוספת (בקשה מפורשת - "עמוד הבחירות שלי - שינויים"): עד עכשיו
-- לתוצאת trippy AI לא היה מושג "שמור" בכלל - היא פשוט נוצרה ונשמרה
-- (ר' migration 0057) בלי אבחנה בין "זמני" ל"קבוע", ובכלל לא הופיעה
-- בעמוד "הבחירות שלי" (trips/page.tsx - שלף רק מ-trip_builder_sessions).
-- עכשיו, בדיוק כמו is_saved ב-trip_builder_sessions (ר' migration 0033
-- ו-/api/trip-builder/sessions/[sessionId]/save/route.ts): ברירת מחדל
-- false (זמני, 14 יום לפי המנגנון הקיים - ר' UNSAVED_CONTENT_RETENTION_DAYS
-- ב-src/constants/contentRetention.ts) - לחיצה על "שמור" הופכת ל-true
-- (קבוע, מופיע בלשונית "שמורים", לא נמחק לעולם).

alter table public.trippy_ai_results
  add column if not exists is_saved boolean not null default false;

create index if not exists trippy_ai_results_user_id_is_saved_idx
  on public.trippy_ai_results (user_id, is_saved);

comment on column public.trippy_ai_results.is_saved is
  'האם המשתמש לחץ "שמור" על תוצאת trippy AI הזו - true = קבועה לצמיתות ומופיעה בלשונית "שמורים", false (ברירת מחדל) = זמנית, ניתנת להסרה לפי המנגנון הקיים אחרי UNSAVED_CONTENT_RETENTION_DAYS.';
