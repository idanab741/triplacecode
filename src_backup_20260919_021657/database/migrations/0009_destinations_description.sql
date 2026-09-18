-- ========================================================================
-- Migration 0009: מוסיף עמודת description לטבלת destinations
-- (משפט תיאור קצר לעמוד מדריך היעד)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

alter table public.destinations add column description text;
