-- ========================================================================
-- Migration 0059: notifications + notification_reads
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- ארכיטקטורה (ר' MASTER PROMPT - "לא כל דבר חייב להישמר כ-row בטבלת
-- notifications"): שני סוגי מידע נפרדים -
--
-- A. Persistent notifications (הטבלה הזו) - רק דברים שבאמת צריך לשמור:
--    הודעות Admin (גלובליות או אישיות). user_id=null = גלובלית לכולם.
--
-- B. Computed activity (לא נשמר כאן בכלל) - טיול מתקרב / טיול שנשמר /
--    מקום שנשמר - מחושבים "on the fly" מהטבלאות הקיימות
--    (trip_builder_sessions, favorites) בזמן קריאה, ר'
--    services/notifications/notificationsService.ts.
--
-- שתי הקטגוריות חולקות את אותה מנגנון read/unread (notification_reads
-- למטה) - activity_key גנרי (טקסט, לא FK קשיח) מאפשר למחשב-דטרמיניסטית
-- state של "נקרא" גם להתראה אמיתית (notif:<id>) וגם לפעילות מחושבת
-- (למשל trip_upcoming:<sessionId>:<milestone>) בלי ליצור שורת DB
-- לכל אירוע מחושב - זה גם מה שמונע את בעיית ה"כפילויות" (סעיף 31
-- בפרומפט): milestone חדש = key חדש = "לא נקרא" מחדש, אותו milestone
-- שכבר נצפה = אותו key = כבר "נקרא", בלי ליצור רשומות נוספות בכלל.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- null = הודעה גלובלית לכל המשתמשים. לא-null = הודעה אישית.
  user_id uuid references auth.users (id) on delete cascade,
  type text not null default 'system',
  title text not null,
  description text not null default '',
  image_url text,
  icon text,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  action_url text,
  action_label text,
  source_type text default 'admin',
  source_id text,
  push_enabled boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- קריאה: הודעה גלובלית פעילה, או הודעה אישית פעילה של המשתמש עצמו -
-- בשני המקרים רק אם כבר פורסמה ועוד לא פגה. אין כאן policy לכתיבה
-- בכלל (insert/update/delete) - ניהול נעשה אך ורק דרך /api/admin/notifications
-- עם service_role (createAdminClient, עוקף RLS), לא ישירות מהלקוח.
create policy "Users can view relevant active notifications"
  on public.notifications for select
  using (
    status = 'active'
    and published_at <= now()
    and (expires_at is null or expires_at > now())
    and (user_id is null or user_id = auth.uid())
  );

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_status_published_idx on public.notifications (status, published_at desc);

comment on table public.notifications is
  'הודעות מערכת/Admin בלבד (persistent) - לא כולל פעילות מחושבת (טיול מתקרב/נשמר) שמחושבת on-the-fly, ראו services/notifications/notificationsService.ts.';

-- ------------------------------------------------------------------------

create table public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- מזהה גנרי: "notif:<notifications.id>" להודעת Admin, או מפתח מחושב
  -- דטרמיניסטי לפעילות מחושבת (למשל "trip_upcoming:<sessionId>:7d",
  -- "trip_saved:<sessionId>", "favorite_saved:<placeId>").
  activity_key text not null,
  read_at timestamptz not null default now(),
  unique (user_id, activity_key)
);

alter table public.notification_reads enable row level security;

create policy "Users can view their own read state"
  on public.notification_reads for select
  using (auth.uid() = user_id);

create policy "Users can insert their own read state"
  on public.notification_reads for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own read state"
  on public.notification_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index notification_reads_user_id_idx on public.notification_reads (user_id);

comment on table public.notification_reads is
  'מצב "נקרא" גנרי - מכסה גם הודעות Admin (notifications) וגם פעילות מחושבת (activity_key דטרמיניסטי, לא FK). ראו הערה מפורטת למעלה בקובץ.';
