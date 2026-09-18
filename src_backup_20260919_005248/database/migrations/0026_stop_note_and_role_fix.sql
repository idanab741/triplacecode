-- ========================================================================
-- Migration 0026: trip_builder_stops - עמודת note (כוונה ספציפית מהמלל
-- החופשי לכל תחנה) + תיקון CHECK constraint על role שהיה חסר bar/spa
-- (כבר בשימוש בקוד - services/tripBuilder/categoryPlanService.ts - אבל
-- לא היה מותר ב-DB, כלומר insert עם role="bar"/"spa" היה נכשל בשקט).
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- תוספת/תיקון בלבד - שום שורה קיימת לא נמחקת.
-- ========================================================================

alter table public.trip_builder_stops
  add column if not exists note text;

comment on column public.trip_builder_stops.note is
  'תיאור קצר בעברית של מה בדיוק התחנה הזו אמורה להיות, לפי המלל החופשי (לדוגמה "עגלת קפה בסביבה טבעית") - נקבע בשלב תכנון הקטגוריות ומועבר הלאה לשלב בחירת המקום הספציפי.';

alter table public.trip_builder_stops
  drop constraint if exists trip_builder_stops_role_check;

alter table public.trip_builder_stops
  add constraint trip_builder_stops_role_check
  check (role in ('attraction', 'food', 'coffee_dessert', 'viewpoint', 'bar', 'spa'));
