-- ========================================================================
-- Migration 0068: place's — Stage 1 (חלק 3/N)
-- posts + post_media + post_likes + comments
-- ========================================================================

-- ------------------------------------------------------------------------
-- 9-10. posts (סעיף 13, 14, 67 באפיון) - כולל Video דרך post_type/media
-- ------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  text text,
  post_type text not null default 'post',
  place_id uuid references public.places (id) on delete set null,
  destination_id uuid references public.destinations (id) on delete set null,
  trip_id uuid, -- FK אל trips מתווסף במיגרציית ה-trips (0073) כדי לא להפוך את הסדר
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_type_check
    check (post_type in ('post', 'video', 'review', 'trip', 'place_recommendation', 'destination_recommendation', 'photo')),
  constraint posts_visibility_check
    check (visibility in ('public', 'followers', 'friends', 'private'))
);

create index posts_author_id_idx on public.posts (author_id) where deleted_at is null;
create index posts_created_at_idx on public.posts (created_at desc) where deleted_at is null;
create index posts_place_id_idx on public.posts (place_id) where place_id is not null;
create index posts_visibility_idx on public.posts (visibility) where deleted_at is null;

alter table public.posts enable row level security;

-- select: לפי visibility + יחס בין הצופה למחבר, ותוך התחשבות בחסימות
create policy "Users can view posts according to visibility"
  on public.posts for select
  using (
    deleted_at is null
    and not public.is_blocked_between(auth.uid(), author_id)
    and (
      author_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'followers' and exists (
            select 1 from public.follows
            where follower_id = auth.uid() and following_id = posts.author_id
          ))
      or (visibility = 'friends' and exists (
            select 1 from public.friendships
            where status = 'accepted'
              and ((requester_id = auth.uid() and addressee_id = posts.author_id)
                or (addressee_id = auth.uid() and requester_id = posts.author_id))
          ))
    )
  );

create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = author_id);

create policy "Users can soft-delete their own posts via update"
  on public.posts for delete
  using (auth.uid() = author_id);

create trigger set_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

comment on table public.posts is 'Feed content object מרכזי - post/video/review/trip/place_recommendation וכו'' (סעיף 9)';


-- ------------------------------------------------------------------------
-- post_media (סעיף 68 באפיון)
-- ------------------------------------------------------------------------

create table public.post_media (
  post_id uuid not null references public.posts (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (post_id, media_id)
);

create index post_media_post_id_idx on public.post_media (post_id);

alter table public.post_media enable row level security;

-- חשיפת מדיה של פוסט תלויה בהרשאת הקריאה של הפוסט עצמו
create policy "Users can view media of posts they can view"
  on public.post_media for select
  using (
    exists (select 1 from public.posts where id = post_media.post_id)
  );

create policy "Authors can attach media to their own posts"
  on public.post_media for insert
  with check (
    exists (select 1 from public.posts where id = post_media.post_id and author_id = auth.uid())
  );

create policy "Authors can remove media from their own posts"
  on public.post_media for delete
  using (
    exists (select 1 from public.posts where id = post_media.post_id and author_id = auth.uid())
  );


-- ------------------------------------------------------------------------
-- 11. post_likes (סעיף 69 באפיון)
-- ------------------------------------------------------------------------

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_post_id_idx on public.post_likes (post_id);
create index post_likes_user_id_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

create policy "Users can view likes on posts they can view"
  on public.post_likes for select
  using (
    exists (select 1 from public.posts where id = post_likes.post_id)
  );

create policy "Users can like as themselves"
  on public.post_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts where id = post_likes.post_id)
  );

create policy "Users can unlike their own like"
  on public.post_likes for delete
  using (auth.uid() = user_id);


-- ------------------------------------------------------------------------
-- 12. comments (סעיף 70 באפיון) - כולל תמיכה ב-Replies דרך parent_comment_id
-- ------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_post_id_idx on public.comments (post_id) where deleted_at is null;
create index comments_parent_comment_id_idx on public.comments (parent_comment_id) where parent_comment_id is not null;
create index comments_author_id_idx on public.comments (author_id);

alter table public.comments enable row level security;

create policy "Users can view comments on posts they can view"
  on public.comments for select
  using (
    deleted_at is null
    and exists (select 1 from public.posts where id = comments.post_id)
  );

create policy "Users can comment as themselves"
  on public.comments for insert
  with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts where id = comments.post_id)
  );

create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = author_id);

create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = author_id);

create trigger set_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

comment on table public.comments is 'תגובות על posts, עם תמיכה ב-replies דרך parent_comment_id (סעיף 70)';
