-- ========================================================================
-- Migration 0066: place's — Stage 1 (חלק 1/N)
-- הרחבת profiles + follows + friendships + blocks
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- הערה חשובה: זו הרחבה של טבלת profiles הקיימת (0001_profiles.sql),
-- לא יצירה מחדש. אין שכפול של full_name / avatar_url / city / country
-- (סעיף 61 באפיון). ה-RLS הקיים על profiles (0001) נשמר במלואו -
-- אנחנו רק *מוסיפים* policy נוספת ל-select ציבורי לפי profile_visibility,
-- בלי לגעת ב-policies הקיימות.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1-3. הרחבת profiles: username, bio, cover, website, creator flags,
--      profile_visibility, last_seen (סעיפים 1,2,3,61 באפיון)
-- ------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists cover_url text,
  add column if not exists website text,
  add column if not exists is_creator boolean not null default false,
  add column if not exists creator_status text not null default 'none',
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists last_seen timestamptz;

-- ולידציה על ערכים מותרים
alter table public.profiles
  add constraint profiles_creator_status_check
    check (creator_status in ('none', 'pending', 'approved', 'rejected', 'suspended'));

alter table public.profiles
  add constraint profiles_visibility_check
    check (profile_visibility in ('public', 'private'));

-- username ייחודי (case-insensitive), רק אותיות/ספרות/קו תחתון, 3-30 תווים
alter table public.profiles
  add constraint profiles_username_format_check
    check (
      username is null
      or username ~ '^[a-zA-Z0-9_]{3,30}$'
    );

create unique index profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create index profiles_is_creator_idx on public.profiles (is_creator) where is_creator = true;

-- מדיניות select ציבורית נוספת: כל אחד מחובר יכול לראות פרופילים public,
-- וכל creator תמיד נראה (ברירת מחדל Public לפי סעיף 20).
-- זו policy *נוספת* ל-OR מול "Users can view their own profile" הקיימת -
-- לא מחליפה אותה.
create policy "Anyone can view public or creator profiles"
  on public.profiles for select
  using (profile_visibility = 'public' or is_creator = true);

comment on column public.profiles.username is 'שם משתמש ייחודי ל-place''s, ב-lowercase לצורך ייחודיות';
comment on column public.profiles.profile_visibility is 'public/private - שולט על גישה ל-Feed, Search, Follow-preview';
comment on column public.profiles.creator_status is 'סטטוס בקשת Creator: none/pending/approved/rejected/suspended';


-- ------------------------------------------------------------------------
-- 4. follows — יחס חד-צדדי (סעיף 20, 64 באפיון)
-- ------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index follows_following_id_idx on public.follows (following_id);
create index follows_follower_id_idx on public.follows (follower_id);

alter table public.follows enable row level security;

-- כל אחד רואה מי עוקב אחרי מי (הרשימות עצמן ציבוריות - עקביות עם Followers/Following counts בפרופיל)
create policy "Anyone can view follow relationships"
  on public.follows for select
  using (true);

create policy "Users can follow as themselves"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

comment on table public.follows is 'Follow חד-צדדי. שונה מהותית מ-friendships (סעיף 19 באפיון - אין לערבב)';


-- ------------------------------------------------------------------------
-- 5. friendships — יחס דו-צדדי עם סטטוס (סעיף 19, 63 באפיון)
-- ------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self_request check (requester_id <> addressee_id),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined', 'blocked'))
);

-- מניעת כפילות בכל צירוף, ללא תלות בכיוון (least/greatest מנרמל את הסדר)
create unique index friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);
create index friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;

create policy "Users can view friendships they are part of"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests as themselves"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- רק המבקש יכול לבטל (delete בסטטוס pending), רק שני הצדדים יכולים לעדכן סטטוס
-- (accept/decline ע"י addressee, וגם requester/addressee יכולים "להסיר חבר" לאחר accepted)
create policy "Participants can update friendship status"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Participants can delete their friendship"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

comment on table public.friendships is 'Friendship דו-צדדי עם בקשה/אישור. שונה מ-follows (סעיף 19)';


-- ------------------------------------------------------------------------
-- 6. blocks — חסימה מוחלטת (סעיף 56, 65 באפיון)
-- ------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- חסימות הן פרטיות - רק החוסם רואה את מי שהוא חסם (לא נחשף למי שנחסם)
create policy "Users can view their own blocks"
  on public.blocks for select
  using (auth.uid() = blocker_id);

create policy "Users can block as themselves"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock as themselves"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

comment on table public.blocks is 'חסימה מוחלטת וחד-צדדית. נאכפת ברמת ה-service/API בכל שאילתת social (סעיף 56)';


-- ------------------------------------------------------------------------
-- helper function: is_blocked_between - לשימוש ב-RLS/policies עתידיות
-- (posts, comments, chat וכו') כדי לא לשכפל לוגיקה בכל טבלה
-- ------------------------------------------------------------------------

create or replace function public.is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

comment on function public.is_blocked_between is 'בודק אם יש חסימה (בכל כיוון) בין שני משתמשים - לשימוש ב-RLS/services של תוכן חברתי';
