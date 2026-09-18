-- ========================================================================
-- Migration 0050: תיקון RLS על שני טבלאות המטמון החדשות
-- (destination_airport_cache, destination_neighborhood_cache) - נמצא
-- בלוגים בפועל: "new row violates row-level security policy". Supabase
-- מפעיל RLS כברירת מחדל על טבלה חדשה בלי אף policy - זה חוסם לגמרי
-- כתיבה למטמון (בשקט, כי הקוד לא-חוסם בכוונה - אבל המטמון בפועל אף
-- פעם לא נשמר). אלה טבלאות מטמון גלובליות בלבד (לא מידע פרטי של
-- משתמש - שם שדה תעופה/שכונה לפי יעד) - קריאה וכתיבה פתוחות לכל
-- משתמש מאומת זה בטוח ונכון כאן.
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- ========================================================================

alter table public.destination_airport_cache enable row level security;
alter table public.destination_neighborhood_cache enable row level security;

drop policy if exists "authenticated can read airport cache" on public.destination_airport_cache;
create policy "authenticated can read airport cache"
  on public.destination_airport_cache for select
  to authenticated
  using (true);

drop policy if exists "authenticated can write airport cache" on public.destination_airport_cache;
create policy "authenticated can write airport cache"
  on public.destination_airport_cache for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated can read neighborhood cache" on public.destination_neighborhood_cache;
create policy "authenticated can read neighborhood cache"
  on public.destination_neighborhood_cache for select
  to authenticated
  using (true);

drop policy if exists "authenticated can write neighborhood cache" on public.destination_neighborhood_cache;
create policy "authenticated can write neighborhood cache"
  on public.destination_neighborhood_cache for insert
  to authenticated
  with check (true);
