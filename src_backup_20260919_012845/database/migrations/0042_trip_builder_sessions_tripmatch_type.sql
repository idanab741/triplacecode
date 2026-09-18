-- ========================================================================
-- Migration 0042: מרחיב את ה-check constraint על trip_builder_sessions.trip_type
-- כדי לאפשר גם 'tripmatch' - טיולים שנוצרים אוטומטית ממסך התוצאות של
-- TripMatch (ראו /api/trip-builder/sessions/from-tripmatch). בלי המיגרציה
-- הזו, כל insert עם trip_type='tripmatch' נכשל בשקט על ה-check constraint
-- המקורי (0013_trip_builder.sql), וה-UI (כפתורי שיתוף/שמירה במסך תוצאות
-- TripMatch) אף פעם לא מקבל sessionId ולכן לעולם לא מוצג.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

alter table public.trip_builder_sessions
  drop constraint if exists trip_builder_sessions_trip_type_check;

alter table public.trip_builder_sessions
  add constraint trip_builder_sessions_trip_type_check check (trip_type in (
    'day_trip', 'nature_trip', 'weekend', 'romantic_date',
    'restaurants_cafes', 'nightlife', 'abroad_vacation', 'tripmatch'
  ));
