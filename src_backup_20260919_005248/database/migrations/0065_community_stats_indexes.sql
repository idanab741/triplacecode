-- ========================================================================
-- Migration 0065: community stats indexes (favorites + tripmatch_sessions)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- *** תוספת (בקשה מפורשת - "נתונים על האטרקציה: כמה אהבו/לא אהבו/
-- שמרו"): עד עכשיו שאילתות על favorites תמיד היו מסוננות קודם לפי
-- user_id (המשתמש המחובר, ר' RLS ב-migration 0006) - האינדקס היחיד
-- שהיה (unique על user_id+place_id) לא יעיל לחיפוש הפוך "כל מי ששמר/
-- אהב מקום ספציפי X" (ר' placeCommunityStatsService.ts - שאילתה חדשה
-- כזו, לפי place_id בלבד, דרך service_role שעוקף RLS). אותו דבר
-- לגבי rejected_place_ids (מערך) ב-tripmatch_sessions - containment
-- query (@>) בלי אינדקס GIN סורק את כל הטבלה.

create index if not exists favorites_place_id_idx
  on public.favorites (place_id);

create index if not exists tripmatch_sessions_rejected_place_ids_gin_idx
  on public.tripmatch_sessions using gin (rejected_place_ids);

comment on index public.favorites_place_id_idx is
  'תומך בשאילתות "כל מי ששמר/אהב מקום X" (community stats) - בנוסף לאינדקס הייחודי הקיים על (user_id, place_id).';

comment on index public.tripmatch_sessions_rejected_place_ids_gin_idx is
  'תומך בשאילתת containment (@>) יעילה של "כמה סשנים דחו מקום X" - בלי זה, כל שאילתה כזו סורקת את כל הטבלה.';
