-- ========================================================================
-- Migration 0010: אינדקס חיפוש טקסטואלי (Full-Text Search) על places
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- הערה: Postgres לא כולל מילון עברי מובנה, לכן משתמשים בקונפיגורציית
-- 'simple' (טוקניזציה בלי נטיות) - עדיין עובד היטב לחיפוש מהיר.
--
-- הערה טכנית: אי אפשר להשתמש ב-GENERATED ALWAYS AS עם to_tsvector
-- (Postgres לא מכיר בה כ"immutable"), ולכן משתמשים בעמודה רגילה
-- שמתעדכנת אוטומטית ע"י טריגר.
-- ========================================================================

alter table public.places add column search_vector tsvector;

create function public.places_update_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.city, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(new.tags, ' ')), 'C');
  return new;
end;
$$;

create trigger places_search_vector_trigger
  before insert or update on public.places
  for each row execute function public.places_update_search_vector();

-- מילוי חד-פעמי לשורות קיימות (מפעיל את הטריגר על ידי "עדכון ריק")
update public.places set id = id;

create index places_search_vector_idx on public.places using gin (search_vector);
