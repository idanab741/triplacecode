-- ========================================================================
-- Migration 0058: trippy_ai_results share_token
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- *** תוספת (בקשה מפורשת - "אפשרות לשמירה ושיתוף"): טוקן אקראי ולא-
-- ניחושי לכל תוצאה - "כרטיס הכניסה" לצפייה ציבורית בתוצאה ספציפית בלי
-- להתחבר, בלי לחשוף שום שורה אחרת בטבלה (ר' /api/trippy-ai/shared/[token]/
-- route.ts - קורא עם service_role, מסונן רק לפי טוקן מדויק - לא RLS
-- ציבורי גורף שהיה חושף את כל השורות של כל המשתמשים).

alter table public.trippy_ai_results
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists trippy_ai_results_share_token_idx
  on public.trippy_ai_results (share_token);

comment on column public.trippy_ai_results.share_token is
  'טוקן אקראי לשיתוף ציבורי (קריאה בלבד) - נקרא עם service_role, לא RLS ציבורי. לא מתחדש - אם נחשף, המשתמש יכול למחוק ולבנות טיול חדש.';
