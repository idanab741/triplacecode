-- ========================================================================
-- Migration 0081: tripadd_reviews - הפרדת "מקום" מ"ביקורת", ואיחוד
-- כפילויות קיימות (בקשה מפורשת - "Jasmino מופיע פעמיים, הביקורות
-- צריכות להיות רשומות למטה מסודרות")
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- *** שינוי-שורש: עד עכשיו כל הוספה של מקום ב-TripAdd יצרה שורה
-- עצמאית ב-tripadd_submissions, עם rating+description צמודים אליה -
-- כלומר "מקום" ו"ביקורת בודדת" היו אותו דבר. זו הסיבה שהוספה שנייה
-- של אותו מקום פיזי (Jasmino) יצרה "מקום" שני, לא ביקורת נוספת על
-- אותו מקום. tripadd_reviews מפריד בין השניים: tripadd_submissions
-- נשארת "המקום" (שם/קטגוריה/מיקום/תמונות), tripadd_reviews היא
-- הביקורות (דירוג+תיאור אישי, אחת לכל משתמש לכל מקום).
-- ========================================================================

create table public.tripadd_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.tripadd_submissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint,
  description text,
  created_at timestamptz not null default now(),
  constraint tripadd_reviews_rating_check check (rating is null or (rating >= 1 and rating <= 5)),
  -- משתמש אחד = ביקורת אחת למקום (הוספה חוזרת של אותו מקום מעדכנת
  -- את הביקורת הקיימת שלו, לא יוצרת עוד אחת - ר' tripAddService.ts).
  unique (submission_id, user_id)
);

alter table public.tripadd_reviews enable row level security;

-- אותו עיקרון בדיוק כמו migration 0080 על tripadd_submissions עצמה -
-- ביקורות קהילתיות, לא פרטיות למי שכתב אותן.
create policy "Authenticated users can view all tripadd reviews"
  on public.tripadd_reviews for select
  to authenticated
  using (true);

create policy "Users can insert their own tripadd review"
  on public.tripadd_reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tripadd review"
  on public.tripadd_reviews for update
  using (auth.uid() = user_id);

create index tripadd_reviews_submission_id_idx on public.tripadd_reviews (submission_id);

-- *** גיבוי נתונים קיימים: כל שורה קיימת ב-tripadd_submissions כבר
-- מכילה בפועל "ביקורת" (rating+description+submitted_by) - מעתיקים
-- אותה ל-tripadd_reviews כדי שלא ילך לאיבוד כשהעמוד יעבור להציג רק
-- מתוך הטבלה החדשה. on conflict do nothing - הרצה חוזרת של המיגרציה בטעות לא תיכשל.
insert into public.tripadd_reviews (submission_id, user_id, rating, description, created_at)
select id, submitted_by, rating, description, created_at
from public.tripadd_submissions
on conflict (submission_id, user_id) do nothing;

-- *** איחוד כפילויות קיימות (בקשה מפורשת - "Jasmino"): לכל קבוצת
-- submissions עם אותו google_place_id (לא null), נשארת רק השורה
-- הכי ותיקה (created_at הכי מוקדם) בתור "המקום" הקנוני - שאר השורות
-- נמחקות, אחרי שהביקורות והתמונות שלהן "עוברות" לשורה הקנונית.
with duplicates as (
  select
    id,
    google_place_id,
    first_value(id) over (partition by google_place_id order by created_at asc, id asc) as canonical_id
  from public.tripadd_submissions
  where google_place_id is not null
),
to_merge as (
  select id, canonical_id from duplicates where id <> canonical_id
)
update public.tripadd_reviews r
set submission_id = m.canonical_id
from to_merge m
where r.submission_id = m.id
  -- אם למשתמש הזה כבר יש ביקורת על השורה הקנונית (למשל הוא זה שהוסיף
  -- את שתי הכפילויות בעצמו) - לא ניתן להעביר בגלל ה-unique constraint;
  -- במקרה הזה משאירים את הישנה יותר על השורה הקנונית ופשוט מוחקים
  -- את הכפולה (הביקורת שלא הצליחה לעבור נמחקת יחד עם ה-submission
  -- הכפולה, ר' on delete cascade למטה - היא ממילא היתה לאותו משתמש).
  and not exists (
    select 1 from public.tripadd_reviews r2
    where r2.submission_id = m.canonical_id and r2.user_id = r.user_id
  );

with duplicates as (
  select
    id,
    google_place_id,
    first_value(id) over (partition by google_place_id order by created_at asc, id asc) as canonical_id
  from public.tripadd_submissions
  where google_place_id is not null
),
to_merge as (
  select id, canonical_id from duplicates where id <> canonical_id
)
update public.tripadd_submission_media med
set submission_id = m.canonical_id
from to_merge m
where med.submission_id = m.id;

with duplicates as (
  select
    id,
    google_place_id,
    first_value(id) over (partition by google_place_id order by created_at asc, id asc) as canonical_id
  from public.tripadd_submissions
  where google_place_id is not null
)
delete from public.tripadd_submissions
where id in (select id from duplicates where id <> canonical_id);

comment on table public.tripadd_reviews is 'ביקורות (דירוג+תיאור אישי) על מקום ב-tripadd_submissions - אחת למשתמש למקום. tripadd_submissions.rating/description נשארים בעמודה (היסטוריה גולמית), אבל התצוגה בעמוד המקום מעכשיו קוראת מכאן.';
