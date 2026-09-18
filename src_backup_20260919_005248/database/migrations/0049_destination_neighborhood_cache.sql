-- ========================================================================
-- Migration 0049: destination_neighborhood_cache - מטמון קבוע לשכונה
-- המרכזית לפי יעד. בקשה מפורשת ("למה התמונה משתנה כל פעם?! חבל על
-- הטוקנים מגוגל") - findCentralNeighborhood קרא ל-Claude בלי מטמון בכל
-- בקשה (גם מה-server וגם מה-client, לאותו יעד, שוב ושוב) - וכיוון
-- שהתשובה לא לגמרי דטרמיניסטית, זה יכול להחזיר עוגן שונה בכל פעם. אותו
-- דפוס בדיוק כמו destination_airport_cache (מיגרציה 0048).
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- ========================================================================

create table if not exists public.destination_neighborhood_cache (
  destination text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  image_url text,
  created_at timestamptz not null default now()
);
