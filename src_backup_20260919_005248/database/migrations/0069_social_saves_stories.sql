-- ========================================================================
-- Migration 0069: place's — Stage 1 (חלק 4/N)
-- social_saves + stories + story_media + story_views
-- ========================================================================

-- ------------------------------------------------------------------------
-- 13. social_saves (סעיף 54, 109, 110 באפיון)
-- שונה במפורש מ-favorites הקיים (שנשאר ייעודי ל-Place). כאן שומרים
-- post/trip. לא ליצור טבלה אחידה עם favorites - סמנטיקה שונה (סעיף 110).
-- ------------------------------------------------------------------------

create table public.social_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint social_saves_target_type_check check (target_type in ('post', 'trip')),
  unique (user_id, target_type, target_id)
);

create index social_saves_user_id_idx on public.social_saves (user_id);
create index social_saves_target_idx on public.social_saves (target_type, target_id);

alter table public.social_saves enable row level security;

create policy "Users can view their own saves"
  on public.social_saves for select
  using (auth.uid() = user_id);

create policy "Users can save as themselves"
  on public.social_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own saves"
  on public.social_saves for delete
  using (auth.uid() = user_id);

comment on table public.social_saves is 'Save חברתי (Post/Trip) - שונה מ-favorites (Place). אין לאחד (סעיף 110)';


-- ------------------------------------------------------------------------
-- 14. stories (סעיף 6, 71 באפיון) - תוכן זמני, expires_at כברירת מחדל 24h
-- ------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  text text,
  place_id uuid references public.places (id) on delete set null,
  trip_id uuid, -- FK מתווסף במיגרציית trips (0073)
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_visibility_check check (visibility in ('public', 'followers', 'friends', 'private'))
);

create index stories_author_id_idx on public.stories (author_id);
create index stories_expires_at_idx on public.stories (expires_at);
-- *** תיקון: לא ניתן להשתמש ב-now() ב-predicate של partial index
-- (42P17 - functions in index predicate must be marked IMMUTABLE, כי
-- התוצאה של now() משתנה). אינדקס רגיל על expires_at (כבר קיים למעלה,
-- stories_expires_at_idx) מספיק כדי שהשאילתה "expires_at > now()"
-- תשתמש באינדקס יעיל - אין צורך ב-partial index נפרד לזה.
create index stories_active_idx on public.stories (expires_at, author_id, created_at desc);

alter table public.stories enable row level security;

create policy "Users can view active stories according to visibility"
  on public.stories for select
  using (
    expires_at > now()
    and not public.is_blocked_between(auth.uid(), author_id)
    and (
      author_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'followers' and exists (
            select 1 from public.follows
            where follower_id = auth.uid() and following_id = stories.author_id
          ))
      or (visibility = 'friends' and exists (
            select 1 from public.friendships
            where status = 'accepted'
              and ((requester_id = auth.uid() and addressee_id = stories.author_id)
                or (addressee_id = auth.uid() and requester_id = stories.author_id))
          ))
    )
  );

create policy "Users can create their own stories"
  on public.stories for insert
  with check (auth.uid() = author_id);

create policy "Users can delete their own stories"
  on public.stories for delete
  using (auth.uid() = author_id);

comment on table public.stories is 'תוכן זמני, פג תוקף אוטומטית אחרי 24 שעות ברירת מחדל (סעיף 71)';


-- ------------------------------------------------------------------------
-- story_media
-- ------------------------------------------------------------------------

create table public.story_media (
  story_id uuid not null references public.stories (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (story_id, media_id)
);

alter table public.story_media enable row level security;

create policy "Users can view media of stories they can view"
  on public.story_media for select
  using (exists (select 1 from public.stories where id = story_media.story_id));

create policy "Authors can attach media to their own stories"
  on public.story_media for insert
  with check (
    exists (select 1 from public.stories where id = story_media.story_id and author_id = auth.uid())
  );


-- ------------------------------------------------------------------------
-- 15. story_views (סעיף 6, 73 באפיון) - מי צפה במה
-- ------------------------------------------------------------------------

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index story_views_story_id_idx on public.story_views (story_id);

alter table public.story_views enable row level security;

-- רק מחבר הסטורי יכול לראות את רשימת הצופים (מי צפה בי)
create policy "Story authors can view who viewed their story"
  on public.story_views for select
  using (
    exists (select 1 from public.stories where id = story_views.story_id and author_id = auth.uid())
    or viewer_id = auth.uid()
  );

create policy "Users can record their own story view"
  on public.story_views for insert
  with check (
    auth.uid() = viewer_id
    and exists (select 1 from public.stories where id = story_views.story_id)
  );

comment on table public.story_views is 'מעקב צפיות - רק בעל הסטורי רואה את הרשימה המלאה (סעיף 6)';


-- ------------------------------------------------------------------------
-- helper: ניקוי סטוריז שפג תוקפם (ל-cron/scheduled job עתידי - לא מיושם כאן,
-- ה-RLS כבר מסנן expires_at > now() כך שאין חשיפה, זו רק ניקיון פיזי)
-- ------------------------------------------------------------------------

create or replace function public.delete_expired_stories()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.stories where expires_at <= now() - interval '7 days';
$$;

comment on function public.delete_expired_stories is 'מיועד להרצה תקופתית (pg_cron / scheduled function) - מוחק סטוריז ישנים פיזית מה-DB. ה-RLS כבר מונע חשיפה מיידית אחרי 24h';
