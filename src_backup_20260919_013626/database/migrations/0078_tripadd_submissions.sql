-- ========================================================================
-- Migration 0078: TripAdd - מאגר עצמאי ונפרד לגמרי להוספת מקומות
-- דרך כפתור ה-(+) הצף מעל המפה בעמוד הבית
--
-- *** בקשה מפורשת ("המאגר הזה מנותק מהמאגר שהיה! זה מאגר חדש..."):
-- זו טבלה חדשה, tripadd_submissions - לא הרחבה של place_submissions
-- הישן (שמשמש את "הצע מקום חדש" הקיים ב-place's/SuggestPlaceSheet.tsx).
-- בכוונה **אין** כאן שום בדיקת כפילות מול places/destinations/
-- place_submissions - זה בדיוק מה שבלבל ("Jasmino כבר קיים אצלנו")
-- כשהיה מחובר למאגר הישן. שתי המערכות עצמאיות זו מזו לחלוטין.
--
-- קטגוריות: אותם 6 ערכים בדיוק כמו שורת "סוגי הטיול" בעמוד הבית
-- (constants/homeQuickCategories.ts) - attraction/food/shopping/
-- nature/nightlife/sleep - לא ה-5 הישנים של place_submissions.
-- ========================================================================

create table public.tripadd_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  rating smallint,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  website text,
  status text not null default 'pending',
  -- ממולא אוטומטית מ-Google אחרי שהמשתמש בחר הצעה מה-autocomplete
  -- (לא מוקלד ידנית) - null אם המשתמש המשיך ידנית כי גוגל לא מצא.
  google_place_id text,
  google_photo_url text,
  -- הושלם ע"י AI/Google *אחרי* השמירה, לא בטופס עצמו - ר' tripAddEnrichmentService.ts
  subcategory text,
  accessible boolean,
  price_level smallint,
  phone text,
  short_description text,
  opening_hours text[],
  enrichment_status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  constraint tripadd_submissions_category_check
    check (category in ('attraction', 'food', 'shopping', 'nature', 'nightlife', 'sleep')),
  constraint tripadd_submissions_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint tripadd_submissions_rating_check
    check (rating is null or (rating >= 1 and rating <= 5)),
  constraint tripadd_submissions_enrichment_status_check
    check (enrichment_status in ('pending', 'done', 'failed', 'skipped'))
);

create index tripadd_submissions_submitted_by_idx on public.tripadd_submissions (submitted_by);
create index tripadd_submissions_status_idx on public.tripadd_submissions (status);

alter table public.tripadd_submissions enable row level security;

create policy "Users can view their own tripadd submissions"
  on public.tripadd_submissions for select
  using (auth.uid() = submitted_by);

create policy "Users can submit a tripadd place as themselves"
  on public.tripadd_submissions for insert
  with check (auth.uid() = submitted_by);

comment on table public.tripadd_submissions is 'מאגר עצמאי ונפרד לגמרי מ-place_submissions - הוספת מקום דרך כפתור ה-+ הצף מעל המפה. לא מחובר ל-places/destinations הקיימים.';

create table public.tripadd_submission_media (
  submission_id uuid not null references public.tripadd_submissions (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (submission_id, media_id)
);

alter table public.tripadd_submission_media enable row level security;

create policy "Users can view media of their own tripadd submissions"
  on public.tripadd_submission_media for select
  using (
    exists (select 1 from public.tripadd_submissions where id = tripadd_submission_media.submission_id and submitted_by = auth.uid())
  );

create policy "Users can attach media to their own tripadd submissions"
  on public.tripadd_submission_media for insert
  with check (
    exists (select 1 from public.tripadd_submissions where id = tripadd_submission_media.submission_id and submitted_by = auth.uid())
  );
