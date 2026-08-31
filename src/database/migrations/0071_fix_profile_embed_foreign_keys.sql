-- ========================================================================
-- Migration 0071: תיקון FK ל-embedding אמיתי דרך PostgREST
--
-- הבעיה: כל הטבלאות מ-0066-0070 (follows, friendships, blocks,
-- creator_profiles, posts, comments, post_likes, stories, story_views)
-- הצביעו ב-references auth.users(id) - ואילו services/social/*.ts
-- כתובים עם select embed syntax כמו "profiles!follows_follower_id_fkey"
-- כדי לקבל בשאילתה אחת גם את פרטי הפרופיל (שם/אווטאר). PostgREST יכול
-- לבצע embed רק כשיש FK *ישיר* בין שתי הטבלאות בשאילתה - וכיוון ש-
-- follows ו-profiles שתיהן רק מצביעות בנפרד ל-auth.users, אין ביניהן
-- קשר ישיר, וה-embed נכשל בזמן ריצה.
--
-- התיקון: מצביעים ישירות ל-public.profiles(id) במקום auth.users(id).
-- זה בטוח לחלוטין - profiles.id הוא תמיד בדיוק אותו UUID כמו auth.users.id
-- (ר' migration 0001, טריגר handle_new_user יוצר שורת profiles אוטומטית
-- לכל user חדש, ו-profiles.id הוא PK+FK ל-auth.users(id) on delete cascade)
-- כך שאין שום שינוי בערכים או בהתנהגות - רק תוספת אפשרות ה-embed.
-- שמות ה-constraints נשארים זהים (ברירת המחדל של Postgres:
-- <table>_<column>_fkey) כדי שה-embed syntax הקיים בקוד ימשיך לעבוד
-- בלי לשנות אף שורת TypeScript.
-- ========================================================================

alter table public.follows drop constraint follows_follower_id_fkey;
alter table public.follows add constraint follows_follower_id_fkey
  foreign key (follower_id) references public.profiles (id) on delete cascade;

alter table public.follows drop constraint follows_following_id_fkey;
alter table public.follows add constraint follows_following_id_fkey
  foreign key (following_id) references public.profiles (id) on delete cascade;

alter table public.friendships drop constraint friendships_requester_id_fkey;
alter table public.friendships add constraint friendships_requester_id_fkey
  foreign key (requester_id) references public.profiles (id) on delete cascade;

alter table public.friendships drop constraint friendships_addressee_id_fkey;
alter table public.friendships add constraint friendships_addressee_id_fkey
  foreign key (addressee_id) references public.profiles (id) on delete cascade;

alter table public.blocks drop constraint blocks_blocker_id_fkey;
alter table public.blocks add constraint blocks_blocker_id_fkey
  foreign key (blocker_id) references public.profiles (id) on delete cascade;

alter table public.blocks drop constraint blocks_blocked_id_fkey;
alter table public.blocks add constraint blocks_blocked_id_fkey
  foreign key (blocked_id) references public.profiles (id) on delete cascade;

alter table public.creator_profiles drop constraint creator_profiles_user_id_fkey;
alter table public.creator_profiles add constraint creator_profiles_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.posts drop constraint posts_author_id_fkey;
alter table public.posts add constraint posts_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;

alter table public.post_likes drop constraint post_likes_user_id_fkey;
alter table public.post_likes add constraint post_likes_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.comments drop constraint comments_author_id_fkey;
alter table public.comments add constraint comments_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;

alter table public.stories drop constraint stories_author_id_fkey;
alter table public.stories add constraint stories_author_id_fkey
  foreign key (author_id) references public.profiles (id) on delete cascade;

alter table public.story_views drop constraint story_views_viewer_id_fkey;
alter table public.story_views add constraint story_views_viewer_id_fkey
  foreign key (viewer_id) references public.profiles (id) on delete cascade;

-- place_reviews הוא טבלה קיימת מלפני place's (migration 0043) - מוסיפים
-- כאן רק את יכולת ה-embed, בלי לשנות שום עמודה/מדיניות/לוגיקה קיימת שלה.
alter table public.place_reviews drop constraint place_reviews_user_id_fkey;
alter table public.place_reviews add constraint place_reviews_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
