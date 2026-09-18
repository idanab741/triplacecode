-- ========================================================================
-- Migration 0047: trip_builder_sessions - עמודת vacation_context (Context
-- Engine) - מאחדת DNA/טיסות/מלון/מזג אוויר/תקציב פעם אחת לכל session,
-- כדי שכל קריאת Blueprint (generateDayBlueprint, ר' dayBlueprintService.ts)
-- תקבל את אותו הקשר עקבי בלי לאסוף הכל מחדש בכל קריאה. עמודה נפרדת
-- בכוונה מ-answers (זה "מה שהמערכת חישבה", לא "מה שהמשתמש ענה" הגולמי).
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- תוספת בלבד (add column if not exists) - שום שורה קיימת לא נמחקת/משתנה.
-- ========================================================================

alter table public.trip_builder_sessions
  add column if not exists vacation_context jsonb;
