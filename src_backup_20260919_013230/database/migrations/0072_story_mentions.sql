-- ========================================================================
-- Migration 0072: story_mentions - תיוג אנשים בסטורי
-- ========================================================================

create table public.story_mentions (
  story_id uuid not null references public.stories (id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, mentioned_user_id)
);

create index story_mentions_mentioned_user_idx on public.story_mentions (mentioned_user_id);

alter table public.story_mentions enable row level security;

-- נראה לכל מי שיכול לראות את הסטורי עצמו (אותה בדיקת visibility/blocks
-- כבר קיימת ב-RLS של stories - כאן מסתמכים על exists על stories, שכבר
-- מסונן נכון בזכות ה-RLS שלה עצמה)
create policy "Users can view mentions on stories they can view"
  on public.story_mentions for select
  using (exists (select 1 from public.stories where id = story_mentions.story_id));

create policy "Authors can tag people on their own stories"
  on public.story_mentions for insert
  with check (
    exists (select 1 from public.stories where id = story_mentions.story_id and author_id = auth.uid())
  );

comment on table public.story_mentions is 'תיוג משתמשים בסטורי (סעיף 53) - יוצר גם STORY_REPLY/mention notification';
