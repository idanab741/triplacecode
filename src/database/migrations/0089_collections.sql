-- ========================================================================
-- Migration 0089: place's — אוספים (Collections)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- אוסף = תוכן חברתי שהמשתמש יוצר ומפרסם (לא Saved, לא Post): Creator + Cover +
-- Title + Description + Items. שני סוגים בלבד: 'places' | 'trips' - אין ערבוב.
--
-- *** מחזור מערכות קיימות (לא נוצרות מערכות חדשות):
--  - Visibility: אותם ערכים ואותו דפוס RLS כמו posts (public/followers/friends/private).
--  - Saves: social_saves הקיימת (target_type='collection').
--  - Likes: post_likes הקיימת, עם collection_id לצד post_id (בדיוק אחד מהם).
--  - Comments: comments הקיימת, עם collection_id לצד post_id (בדיוק אחד מהם).
--  - Places: places.id (אותה טבלה שהחיפוש/Place Card הקיימים עובדים מולה).
--  - Trips: trip_builder_sessions / trippy_ai_results הקיימות (שני מקורות ה"טיולים שלי").
-- ========================================================================

-- ------------------------------------------------------------------------
-- collections
-- מחיקה: DELETE אמיתי (ה-FK cascade מנקה פריטים/לייקים/תגובות). לא soft-delete כמו posts -
-- UPDATE של deleted_at נחסם ע"י ה-RLS של הטבלה (השורה החדשה כבר לא עוברת את מדיניות ה-select).
-- ------------------------------------------------------------------------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  collection_type text not null,
  title text not null,
  description text,
  -- NULL = Cover אוטומטי (קולאז' מהמדיה של הפריטים הראשונים, מחושב בזמן קריאה).
  cover_url text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_type_check check (collection_type in ('places', 'trips')),
  constraint collections_visibility_check check (visibility in ('public', 'followers', 'friends', 'private')),
  constraint collections_title_check check (char_length(btrim(title)) between 1 and 80),
  constraint collections_description_check check (description is null or char_length(description) <= 500)
);

create index collections_author_id_idx on public.collections (author_id, created_at desc);
create index collections_created_at_idx on public.collections (created_at desc);

alter table public.collections enable row level security;

-- select: אותו דפוס בדיוק כמו posts (visibility + יחס בין הצופה ליוצר + חסימות)
create policy "Users can view collections according to visibility"
  on public.collections for select
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (
      author_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'followers' and exists (
            select 1 from public.follows
            where follower_id = auth.uid() and following_id = collections.author_id
          ))
      or (visibility = 'friends' and exists (
            select 1 from public.friendships
            where status = 'accepted'
              and ((requester_id = auth.uid() and addressee_id = collections.author_id)
                or (addressee_id = auth.uid() and requester_id = collections.author_id))
          ))
    )
  );

create policy "Users can create their own collections"
  on public.collections for insert
  with check (auth.uid() = author_id);

create policy "Users can update their own collections"
  on public.collections for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Users can delete their own collections"
  on public.collections for delete
  using (auth.uid() = author_id);

create trigger set_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

comment on table public.collections is 'אוסף (Collection) - תוכן חברתי שהמשתמש מפרסם: מקומות או טיולים סביב רעיון אחד. שונה מ-Saved ומ-Post.';


-- ------------------------------------------------------------------------
-- collection_items
-- ------------------------------------------------------------------------

create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_type text not null,
  place_id uuid references public.places (id) on delete cascade,
  -- שני מקורות ה"טיולים שלי" הקיימים (ר' migration 0013 / 0057) - בדיוק אחד מהם לפריט טיול.
  trip_session_id uuid references public.trip_builder_sessions (id) on delete cascade,
  trippy_ai_result_id uuid references public.trippy_ai_results (id) on delete cascade,
  position integer not null default 0,
  -- הערה קצרה אופציונלית לפריט ("הכי כיף להגיע בשבת בבוקר").
  note text,
  created_at timestamptz not null default now(),
  constraint collection_items_type_check check (item_type in ('place', 'trip')),
  constraint collection_items_note_check check (note is null or char_length(note) <= 140),
  constraint collection_items_ref_check check (
    (item_type = 'place' and place_id is not null and trip_session_id is null and trippy_ai_result_id is null)
    or
    (item_type = 'trip' and place_id is null and num_nonnulls(trip_session_id, trippy_ai_result_id) = 1)
  )
);

-- אותו פריט לא מופיע פעמיים באותו אוסף.
create unique index collection_items_place_uidx
  on public.collection_items (collection_id, place_id) where place_id is not null;
create unique index collection_items_trip_session_uidx
  on public.collection_items (collection_id, trip_session_id) where trip_session_id is not null;
create unique index collection_items_trippy_ai_uidx
  on public.collection_items (collection_id, trippy_ai_result_id) where trippy_ai_result_id is not null;

create index collection_items_collection_idx on public.collection_items (collection_id, position);

-- *** אכיפת "אין ערבוב": סוג הפריט חייב להתאים לסוג האוסף (places<->place, trips<->trip).
create function public.collection_items_enforce_type()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  parent_type text;
begin
  select collection_type into parent_type from public.collections where id = new.collection_id;
  if parent_type is null
     or (parent_type = 'places' and new.item_type <> 'place')
     or (parent_type = 'trips' and new.item_type <> 'trip') then
    raise exception 'collection_items.item_type (%) does not match collection type (%)', new.item_type, parent_type;
  end if;
  return new;
end;
$$;

create trigger collection_items_enforce_type_trg
  before insert or update of item_type, collection_id on public.collection_items
  for each row execute function public.collection_items_enforce_type();

alter table public.collection_items enable row level security;

-- הפריטים נחשפים לפי הרשאת הקריאה של האוסף עצמו (ה-subquery כפוף ל-RLS של collections).
create policy "Users can view items of collections they can view"
  on public.collection_items for select
  using (exists (select 1 from public.collections where id = collection_items.collection_id));

-- רק היוצר מוסיף פריטים; ופריט-טיול חייב להיות טיול של היוצר עצמו
-- (ה-subquery על trip_builder_sessions / trippy_ai_results כפוף ל-RLS "בעלים בלבד").
create policy "Authors can add items to their own collections"
  on public.collection_items for insert
  with check (
    exists (select 1 from public.collections where id = collection_items.collection_id and author_id = auth.uid())
    and (trip_session_id is null
         or exists (select 1 from public.trip_builder_sessions s where s.id = collection_items.trip_session_id))
    and (trippy_ai_result_id is null
         or exists (select 1 from public.trippy_ai_results r where r.id = collection_items.trippy_ai_result_id))
  );

create policy "Authors can update items of their own collections"
  on public.collection_items for update
  using (exists (select 1 from public.collections where id = collection_items.collection_id and author_id = auth.uid()))
  with check (exists (select 1 from public.collections where id = collection_items.collection_id and author_id = auth.uid()));

create policy "Authors can remove items from their own collections"
  on public.collection_items for delete
  using (exists (select 1 from public.collections where id = collection_items.collection_id and author_id = auth.uid()));

comment on table public.collection_items is 'פריטי אוסף: place (places.id) או trip (trip_builder_sessions / trippy_ai_results). סוג הפריט נאכף מול collections.collection_type.';


-- ------------------------------------------------------------------------
-- Saves: social_saves הקיימת - רק מרחיבים את ה-check (Save לא הופך את האוסף לשלך)
-- ------------------------------------------------------------------------

alter table public.social_saves drop constraint social_saves_target_type_check;
alter table public.social_saves
  add constraint social_saves_target_type_check check (target_type in ('post', 'trip', 'collection'));


-- ------------------------------------------------------------------------
-- Likes: post_likes הקיימת - post_id או collection_id (בדיוק אחד).
-- ה-PK המקורי (post_id, user_id) לא מתאים ל-post_id שיכול להיות NULL, לכן PK סינתטי
-- + unique חלקי לכל צד. כל הקוד הקיים (insert/delete/select לפי post_id) ממשיך לעבוד.
-- ------------------------------------------------------------------------

alter table public.post_likes drop constraint post_likes_pkey;
alter table public.post_likes add column id uuid not null default gen_random_uuid();
alter table public.post_likes add primary key (id);
alter table public.post_likes alter column post_id drop not null;
alter table public.post_likes
  add column collection_id uuid references public.collections (id) on delete cascade;
alter table public.post_likes
  add constraint post_likes_target_check check (num_nonnulls(post_id, collection_id) = 1);

create unique index post_likes_post_user_uidx
  on public.post_likes (post_id, user_id) where post_id is not null;
create unique index post_likes_collection_user_uidx
  on public.post_likes (collection_id, user_id) where collection_id is not null;
create index post_likes_collection_id_idx
  on public.post_likes (collection_id) where collection_id is not null;

create policy "Users can view likes on collections they can view"
  on public.post_likes for select
  using (
    collection_id is not null
    and exists (select 1 from public.collections where id = post_likes.collection_id)
  );

create policy "Users can like collections as themselves"
  on public.post_likes for insert
  with check (
    collection_id is not null
    and auth.uid() = user_id
    and exists (select 1 from public.collections where id = post_likes.collection_id)
  );


-- ------------------------------------------------------------------------
-- Comments: comments הקיימת - post_id או collection_id (בדיוק אחד).
-- ------------------------------------------------------------------------

alter table public.comments alter column post_id drop not null;
alter table public.comments
  add column collection_id uuid references public.collections (id) on delete cascade;
alter table public.comments
  add constraint comments_target_check check (num_nonnulls(post_id, collection_id) = 1);

create index comments_collection_id_idx
  on public.comments (collection_id) where deleted_at is null and collection_id is not null;

create policy "Users can view comments on collections they can view"
  on public.comments for select
  using (
    deleted_at is null
    and collection_id is not null
    and exists (select 1 from public.collections where id = comments.collection_id)
  );

create policy "Users can comment on collections as themselves"
  on public.comments for insert
  with check (
    collection_id is not null
    and auth.uid() = author_id
    and exists (select 1 from public.collections where id = comments.collection_id)
  );

comment on column public.comments.collection_id is 'תגובה על אוסף. בדיוק אחד מ-post_id / collection_id מולא.';
comment on column public.post_likes.collection_id is 'לייק על אוסף. בדיוק אחד מ-post_id / collection_id מולא.';
