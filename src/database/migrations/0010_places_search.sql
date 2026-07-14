-- ========================================================================
-- Migration 0010: אינדקס חיפוש טקסטואלי (Full-Text Search) על places
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- הערה: Postgres לא כולל מילון עברי מובנה, לכן משתמשים בקונפיגורציית
-- 'simple' (טוקניזציה בלי נטיות) - עדיין עובד היטב לחיפוש מהיר.
-- ========================================================================

alter table public.places add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'C')
  ) stored;

create index places_search_vector_idx on public.places using gin (search_vector);
