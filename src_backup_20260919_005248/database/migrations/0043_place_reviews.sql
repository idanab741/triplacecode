-- ========================================================================
-- Migration 0043: place_reviews - דירוגי TripLace (בשונה מדירוגי Google
-- שכבר שמורים על places.rating/rating_count) - כל משתמש יכול לדרג מקום
-- פעם אחת (1-5 כוכבים) + טקסט חופשי, ולערוך את הדירוג שלו מאוחר יותר.
-- ========================================================================

create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index place_reviews_place_id_idx on public.place_reviews (place_id);

alter table public.place_reviews enable row level security;

-- כולם יכולים לקרוא את כל הדירוגים (ציבוריים, כמו ביקורות Google) -
-- נדרש כדי לחשב ממוצע+לספור ולהציג את רשימת הביקורות לכל מבקר בעמוד.
create policy "place_reviews_select_all" on public.place_reviews
  for select using (true);

-- משתמש יכול ליצור/לערוך/למחוק רק את הדירוג שלו עצמו.
create policy "place_reviews_insert_own" on public.place_reviews
  for insert with check (auth.uid() = user_id);

create policy "place_reviews_update_own" on public.place_reviews
  for update using (auth.uid() = user_id);

create policy "place_reviews_delete_own" on public.place_reviews
  for delete using (auth.uid() = user_id);
