-- ========================================================================
-- Migration 0097: היומן שלי - שעה, הערה, סוג פריט וקטגוריה
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- (דורש שמיגרציה 0036 - place_calendar_entries - כבר רצה)
--
-- הרעיון (בקשה מפורשת - "לסדר את היומן גם רעיונית"): "שמור" = בלי תאריך,
-- "יומן" = עם תאריך. לכל פריט ביומן עכשיו:
--   - item_type: 'place' (מקום/אטרקציה - places או tripadd) או 'trip'
--     (טיול של הקהילה, טבלת trips). place_id נשאר עמודת text כללית ומחזיק
--     את המזהה של הפריט בשני המקרים.
--   - start_time: שעה (אופציונלי).
--   - note: הערה קצרה (אופציונלי) - "להזמין מקום מראש".
--   - category: קטגוריית המקום בזמן ההוספה - לאייקון סוג הטיול ביומן.
-- ובנוסף הרשאת עדכון, כדי שאפשר יהיה לשנות תאריך/שעה/הערה בלי למחוק.
-- ========================================================================

alter table public.place_calendar_entries
  add column if not exists item_type text not null default 'place',
  add column if not exists start_time time,
  add column if not exists note text,
  add column if not exists category text;

alter table public.place_calendar_entries drop constraint if exists place_calendar_entries_item_type_check;
alter table public.place_calendar_entries
  add constraint place_calendar_entries_item_type_check check (item_type in ('place', 'trip'));

alter table public.place_calendar_entries drop constraint if exists place_calendar_entries_note_length;
alter table public.place_calendar_entries
  add constraint place_calendar_entries_note_length check (note is null or char_length(note) <= 200);

drop policy if exists "Users can update their own place calendar entries" on public.place_calendar_entries;
create policy "Users can update their own place calendar entries"
  on public.place_calendar_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_place_calendar_entries_user_item
  on public.place_calendar_entries (user_id, item_type, place_id);
