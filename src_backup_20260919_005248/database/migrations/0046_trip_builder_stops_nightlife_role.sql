-- ========================================================================
-- Migration 0046: trip_builder_stops - תיקון CHECK constraint על role שהיה
-- חסר 'nightlife' (בדיוק אותו דפוס כמו מיגרציה 0026 שהוסיפה bar/spa) - בלי
-- זה, insert עם role="nightlife" (תחנת חיי-לילה מקובעת בסוף היום בחופשה
-- בחו"ל - ר' services/tripBuilder/categoryPlanService.ts, buildMultiDayVacationPlan)
-- היה נכשל בשקט על ה-CHECK constraint.
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- תוספת/תיקון בלבד - שום שורה קיימת לא נמחקת.
-- ========================================================================

alter table public.trip_builder_stops
  drop constraint if exists trip_builder_stops_role_check;

alter table public.trip_builder_stops
  add constraint trip_builder_stops_role_check
  check (role in ('attraction', 'food', 'coffee_dessert', 'viewpoint', 'bar', 'spa', 'nightlife'));
