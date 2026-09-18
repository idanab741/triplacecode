-- Migration 0033: מדיניות DELETE חסרה על trip_builder_sessions
--
-- הבאג: RLS היה מופעל על trip_builder_sessions (מיגרציה 0013) עם policies
-- ל-SELECT/INSERT/UPDATE בלבד - בלי policy ל-DELETE בכלל. התוצאה: כל בקשת
-- מחיקה נחסמה בשקט ע"י Postgres (0 שורות נמחקות, בלי שגיאה), כך שהשרת
-- דיווח "success: true" בזמן שדבר לא נמחק בפועל - הטיול חזר אחרי רענון.
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ

create policy "Users can delete their own trip builder sessions"
  on public.trip_builder_sessions for delete
  using (auth.uid() = user_id);