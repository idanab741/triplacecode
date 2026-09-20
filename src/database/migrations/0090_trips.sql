-- ========================================================================
-- Migration 0090: place's — טיולים (Trips)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- (דורש שמיגרציה 0089 - אוספים - כבר הורצה)
--
-- טיול = תוכן חברתי: מסלול מתוכנן של תחנות (places) בסדר ברור, עם חלוקה לימים.
-- שונה מ-trip_builder_sessions / trippy_ai_results (אלה תוצרי בניית-טיול פרטיים
-- של משתמש, "בעלים בלבד"), ושונה מ-Collection (אוסף שמאגד טיולים/מקומות).
--
-- *** מחזור מערכות קיימות (לא נוצרות מערכות חדשות):
--  - Visibility: אותם ערכים ואותו דפוס RLS כמו posts / collections.
--  - Saves: social_saves הקיימת - target_type='trip' כבר מותר שם מאז migration 0069.
--  - Likes / Comments: post_likes / comments הקיימות, עם trip_id לצד post_id / collection_id.
--  - Places: places.id (אותה טבלה שהחיפוש/Place Card הקיימים עובדים מולה).
--  - סוג טיול: אותם 7 מזהי QuickCategoryId שכבר קיימים באפליקציה (constants/quickCategories.ts).
--  - Collections: collection_items מקבלת trip_id - טיול יכול להיכלל באוסף מסוג trips
--    (ולא להפך: טיול לא מכיל אוסף).
-- ========================================================================

-- ------------------------------------------------------------------------
-- trips
-- ------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  -- NULL = Cover אוטומטי (התמונה של התחנה הראשונה, מחושבת בזמן קריאה).
  cover_url text,
  -- אופציונלי. אותם מזהים כמו QuickCategoryId (constants/quickCategories.ts).
  trip_type text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_visibility_check check (visibility in ('public', 'followers', 'friends', 'private')),
  constraint trips_type_check check (
    trip_type is null or trip_type in (
      'restaurants_cafes', 'romantic_date', 'weekend', 'nature_trip', 'day_trip', 'abroad', 'nightlife'
    )
  ),
  constraint trips_title_check check (char_length(btrim(title)) between 1 and 80),
  constraint trips_description_check check (description is null or char_length(description) <= 500)
);

create index trips_author_id_idx on public.trips (author_id, created_at desc);
create index trips_created_at_idx on public.trips (created_at desc);

alter table public.trips enable row level security;

-- select: אותו דפוס בדיוק כמו posts / collections. טיול פרטי = רק היוצר; לא ב-Feed ולא זמין לאחרים.
create policy "Users can view trips according to visibility"
  on public.trips for select
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (
      author_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'followers' and exists (
            select 1 from public.follows
            where follower_id = auth.uid() and following_id = trips.author_id
          ))
      or (visibility = 'friends' and exists (
            select 1 from public.friendships
            where status = 'accepted'
              and ((requester_id = auth.uid() and addressee_id = trips.author_id)
                or (addressee_id = auth.uid() and requester_id = trips.author_id))
          ))
    )
  );

create policy "Users can create their own trips"
  on public.trips for insert
  with check (auth.uid() = author_id);

create policy "Users can update their own trips"
  on public.trips for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Users can delete their own trips"
  on public.trips for delete
  using (auth.uid() = author_id);

create trigger set_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

comment on table public.trips is 'טיול (Trip) - תוכן חברתי: מסלול של תחנות בסדר ברור עם חלוקה לימים. שונה מ-trip_builder_sessions (פרטי) ומ-collections (אוסף).';


-- ------------------------------------------------------------------------
-- trip_stops - תחנה = Place + Day + Order (+ הערה אופציונלית)
-- ------------------------------------------------------------------------

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  -- היום בטיול, מ-1. טיול של יום אחד = הכול day_index 1.
  day_index integer not null default 1,
  -- הסדר בתוך היום, מ-0.
  position integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint trip_stops_day_check check (day_index between 1 and 14),
  constraint trip_stops_position_check check (position >= 0),
  constraint trip_stops_note_check check (note is null or char_length(note) <= 140)
);

create index trip_stops_trip_idx on public.trip_stops (trip_id, day_index, position);
create index trip_stops_place_idx on public.trip_stops (place_id);

alter table public.trip_stops enable row level security;

create policy "Users can view stops of trips they can view"
  on public.trip_stops for select
  using (exists (select 1 from public.trips where id = trip_stops.trip_id));

create policy "Authors can add stops to their own trips"
  on public.trip_stops for insert
  with check (exists (select 1 from public.trips where id = trip_stops.trip_id and author_id = auth.uid()));

create policy "Authors can update stops of their own trips"
  on public.trip_stops for update
  using (exists (select 1 from public.trips where id = trip_stops.trip_id and author_id = auth.uid()))
  with check (exists (select 1 from public.trips where id = trip_stops.trip_id and author_id = auth.uid()));

create policy "Authors can remove stops from their own trips"
  on public.trip_stops for delete
  using (exists (select 1 from public.trips where id = trip_stops.trip_id and author_id = auth.uid()));

comment on table public.trip_stops is 'תחנות של טיול: place + day_index + position (+ note). מספר התחנה = position בתוך היום, מחושב בתצוגה.';


-- ------------------------------------------------------------------------
-- replace_trip_stops - החלפה אטומית של כל התחנות של טיול (עריכה: הוספה/הסרה/סדר/ימים/הערות).
-- security invoker (ברירת המחדל): רץ עם ה-RLS של הקורא, כלומר רק היוצר מצליח.
-- פונקציה = טרנזקציה אחת, אז כשל באמצע לא משאיר טיול בלי תחנות.
-- p_stops: [{ "placeId": uuid, "day": int, "position": int, "note": text|null }, ...]
-- ------------------------------------------------------------------------

create function public.replace_trip_stops(p_trip_id uuid, p_stops jsonb)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from public.trips where id = p_trip_id and author_id = auth.uid()) then
    raise exception 'trip not found or not owned by caller' using errcode = '42501';
  end if;

  delete from public.trip_stops where trip_id = p_trip_id;

  insert into public.trip_stops (trip_id, place_id, day_index, position, note)
  select
    p_trip_id,
    (s->>'placeId')::uuid,
    (s->>'day')::int,
    (s->>'position')::int,
    nullif(btrim(s->>'note'), '')
  from jsonb_array_elements(p_stops) as s;
end;
$$;

grant execute on function public.replace_trip_stops(uuid, jsonb) to authenticated;


-- ------------------------------------------------------------------------
-- Likes: post_likes - עכשיו בדיוק אחד מ-post_id / collection_id / trip_id
-- ------------------------------------------------------------------------

alter table public.post_likes drop constraint post_likes_target_check;
alter table public.post_likes
  add column trip_id uuid references public.trips (id) on delete cascade;
alter table public.post_likes
  add constraint post_likes_target_check check (num_nonnulls(post_id, collection_id, trip_id) = 1);

create unique index post_likes_trip_user_uidx
  on public.post_likes (trip_id, user_id) where trip_id is not null;
create index post_likes_trip_id_idx
  on public.post_likes (trip_id) where trip_id is not null;

create policy "Users can view likes on trips they can view"
  on public.post_likes for select
  using (
    trip_id is not null
    and exists (select 1 from public.trips where id = post_likes.trip_id)
  );

create policy "Users can like trips as themselves"
  on public.post_likes for insert
  with check (
    trip_id is not null
    and auth.uid() = user_id
    and exists (select 1 from public.trips where id = post_likes.trip_id)
  );


-- ------------------------------------------------------------------------
-- Comments: comments - עכשיו בדיוק אחד מ-post_id / collection_id / trip_id
-- ------------------------------------------------------------------------

alter table public.comments drop constraint comments_target_check;
alter table public.comments
  add column trip_id uuid references public.trips (id) on delete cascade;
alter table public.comments
  add constraint comments_target_check check (num_nonnulls(post_id, collection_id, trip_id) = 1);

create index comments_trip_id_idx
  on public.comments (trip_id) where deleted_at is null and trip_id is not null;

create policy "Users can view comments on trips they can view"
  on public.comments for select
  using (
    deleted_at is null
    and trip_id is not null
    and exists (select 1 from public.trips where id = comments.trip_id)
  );

create policy "Users can comment on trips as themselves"
  on public.comments for insert
  with check (
    trip_id is not null
    and auth.uid() = author_id
    and exists (select 1 from public.trips where id = comments.trip_id)
  );

comment on column public.comments.trip_id is 'תגובה על טיול. בדיוק אחד מ-post_id / collection_id / trip_id מולא.';
comment on column public.post_likes.trip_id is 'לייק על טיול. בדיוק אחד מ-post_id / collection_id / trip_id מולא.';


-- ------------------------------------------------------------------------
-- Collections: פריט-טיול באוסף יכול להיות גם Trip חברתי (trip_id).
-- "Trip לא יכול להכיל Collection" - הכיוון ההפוך לא קיים ולא ייווצר.
-- ------------------------------------------------------------------------

alter table public.collection_items
  add column trip_id uuid references public.trips (id) on delete cascade;

alter table public.collection_items drop constraint collection_items_ref_check;
alter table public.collection_items
  add constraint collection_items_ref_check check (
    (item_type = 'place' and place_id is not null and trip_session_id is null and trippy_ai_result_id is null and trip_id is null)
    or
    (item_type = 'trip' and place_id is null and num_nonnulls(trip_session_id, trippy_ai_result_id, trip_id) = 1)
  );

create unique index collection_items_trip_uidx
  on public.collection_items (collection_id, trip_id) where trip_id is not null;

-- המדיניות נבנית מחדש כדי להוסיף את trip_id: אפשר להוסיף כל טיול שהיוצר רשאי *לראות*
-- (שלו, או טיול ציבורי/חברים של מישהו אחר - "הטיולים שאני רוצה לעשות").
drop policy "Authors can add items to their own collections" on public.collection_items;
create policy "Authors can add items to their own collections"
  on public.collection_items for insert
  with check (
    exists (select 1 from public.collections where id = collection_items.collection_id and author_id = auth.uid())
    and (trip_session_id is null
         or exists (select 1 from public.trip_builder_sessions s where s.id = collection_items.trip_session_id))
    and (trippy_ai_result_id is null
         or exists (select 1 from public.trippy_ai_results r where r.id = collection_items.trippy_ai_result_id))
    and (trip_id is null
         or exists (select 1 from public.trips t where t.id = collection_items.trip_id))
  );
