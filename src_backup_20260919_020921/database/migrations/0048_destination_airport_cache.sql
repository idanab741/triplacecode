-- ========================================================================
-- Migration 0048: destination_airport_cache - מטמון קבוע לאיתור שדה
-- תעופה לפי יעד. בקשה מפורשת ("למה צריך את גוגל בשביל זה?") - findAirportInfo
-- עשה 2 קריאות Google טריות (geocoding + text search) בכל קריאה, בלי שום
-- מטמון - נקרא גם מה-server (auto-build) וגם מה-client (עמוד התוצאה
-- מרענן את זה בכל טעינה) לאותו יעד, שוב ושוב, לנצח. שדה התעופה של יעד
-- לא משתנה - צריך להיות שאילתה חד-פעמית לכל יעד, לא בכל בקשה.
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- ========================================================================

create table if not exists public.destination_airport_cache (
  destination text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  image_url text,
  created_at timestamptz not null default now()
);
