-- ========================================================================
-- Migration 0093: צ'אט פרטי בין משתמשים (dm_conversations + dm_messages)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- (דורש שמיגרציות 0090 - טיולים, 0081 - place_reviews - כבר רצו)
--
-- ארכיטקטורה (אותו דפוס בדיוק כמו support_conversations/support_messages,
-- migration 0062 - שיחה אחת קבועה בין כל שני משתמשים, לא נוצרת שיחה חדשה
-- בכל פתיחת צ'אט):
--
-- - conversation אחד לכל זוג משתמשים (user_a_id/user_b_id, תמיד ממוינים -
--   user_a_id < user_b_id - כדי שלא ייווצרו שתי שורות הפוכות לאותו זוג).
--   נוצר lazy, בפעם הראשונה ששולחים/פותחים צ'אט עם מישהו (ר' POST
--   /api/social/conversations) - לא כשעוקבים/מתחברים.
--
-- - כל הודעה - row נפרד (לא JSON יחיד), עם kind שקובע איך היא מוצגת:
--   'text' = טקסט חופשי. 'trip'/'place'/'post'/'review' = שיתוף תוכן קיים
--   באפליקציה (מסלול/אטרקציה/פוסט/ביקורת) - ה-id של הפריט המשותף יושב
--   בעמודת ה-FK המתאימה (trip_id/place_id/post_id/review_id), לא בעמודה
--   פולימורפית משותפת - כך יש שלמות רפרנציאלית אמיתית (on delete set null:
--   אם התוכן שנשלח נמחק בעתיד, ההודעה נשארת אבל בלי הפניה שבורה).
--
-- - last_message_at על השיחה מתעדכן ע"י טריגר (לא בקוד השרת) - כדי שיהיה
--   נכון גם אם בעתיד תתווסף עוד נקודת כניסה שמכניסה הודעות.
-- ========================================================================

create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users (id) on delete cascade,
  user_b_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint dm_conversations_distinct_users check (user_a_id <> user_b_id),
  constraint dm_conversations_ordered_users check (user_a_id < user_b_id),
  constraint dm_conversations_unique_pair unique (user_a_id, user_b_id)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'trip', 'place', 'post', 'review')),
  -- טקסט חופשי (kind='text') *או* כיתוב אופציונלי שמצורף לשיתוף (kind אחר).
  text text,
  trip_id uuid references public.trips (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  review_id uuid references public.place_reviews (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  -- כל הודעה חייבת להיות טקסט, *או* בדיוק הפניה אחת לתוכן משותף שתואמת ל-kind שלה.
  constraint dm_messages_kind_matches_ref check (
    (kind = 'text' and text is not null and trip_id is null and place_id is null and post_id is null and review_id is null)
    or (kind = 'trip' and trip_id is not null and place_id is null and post_id is null and review_id is null)
    or (kind = 'place' and place_id is not null and trip_id is null and post_id is null and review_id is null)
    or (kind = 'post' and post_id is not null and trip_id is null and place_id is null and review_id is null)
    or (kind = 'review' and review_id is not null and trip_id is null and place_id is null and post_id is null)
  )
);

create index dm_conversations_user_a_idx on public.dm_conversations (user_a_id);
create index dm_conversations_user_b_idx on public.dm_conversations (user_b_id);
create index dm_conversations_last_message_at_idx on public.dm_conversations (last_message_at desc);
create index dm_messages_conversation_id_idx on public.dm_messages (conversation_id);
create index dm_messages_created_at_idx on public.dm_messages (created_at);
create index dm_messages_unread_idx on public.dm_messages (conversation_id) where read_at is null;

comment on table public.dm_conversations is
  'שיחת צ''אט פרטית בין שני משתמשים - שורה אחת קבועה לכל זוג (user_a_id < user_b_id), נוצרת lazy בפעם הראשונה ששולחים הודעה.';
comment on table public.dm_messages is
  'הודעה בודדת בתוך dm_conversations - row נפרד לכל הודעה. kind קובע אם זו הודעת טקסט או שיתוף תוכן קיים (trip/place/post/review).';

-- ------------------------------------------------------------------------
-- טריגר: אחרי כל הכנסת הודעה, מעדכן last_message_at על השיחה.
-- security definer כדי שיעבוד גם דרך ה-client הרגיל (RLS-respecting),
-- שאין לו הרשאת UPDATE ישירה על dm_conversations (ר' RLS למטה).
-- ------------------------------------------------------------------------
create or replace function public.dm_message_after_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.dm_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger dm_messages_after_insert
  after insert on public.dm_messages
  for each row execute function public.dm_message_after_insert();

-- ------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------

alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;

-- כל משתמש רואה/יוצר רק שיחות שהוא צד בהן. *** בכוונה בלי הגבלת "רק
-- בין עוקבים הדדיים" - כל שני משתמשים רשומים יכולים לפתוח צ'אט ביניהם
-- (בדיוק כמו שחיפוש האנשים בעמוד הצ'אטים כבר מאפשר היום). אם בעתיד
-- ירצו להגביל רק לעוקבים הדדיים, זו הודעה חד-שורתית כאן ב-with check.
create policy "Users can view their own conversations"
  on public.dm_conversations for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Users can create conversations they are a part of"
  on public.dm_conversations for insert
  with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- הודעות: לראות רק בתוך שיחות שהמשתמש צד בהן; ליצור הודעה רק כאשר
-- sender_id = עצמו ורק בתוך שיחה שהוא צד בה - מונע התחזות לצד השני.
create policy "Users can view messages in their own conversations"
  on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

create policy "Users can send messages in their own conversations"
  on public.dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );

-- מותר לעדכן read_at בלבד (סימון "נקרא"), ורק בתוך שיחות שהמשתמש צד בהן -
-- כולל הודעות של עצמו, אבל הקוד בצד השרת מסמן בפועל רק הודעות של הצד
-- השני (ר' GET /api/social/conversations/[id]).
create policy "Users can mark messages read in their own conversations"
  on public.dm_messages for update
  using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.dm_conversations c
      where c.id = dm_messages.conversation_id
        and (c.user_a_id = auth.uid() or c.user_b_id = auth.uid())
    )
  );
