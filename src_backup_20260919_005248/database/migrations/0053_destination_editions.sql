-- ========================================================================
-- Migration 0053: destination_editions - "וריאנטים" תמטיים/עונתיים של יעד
-- (למשל "ניו יורק בכריסמס", "ברצלונה בזמן משחקי הכדורגל") - הישות
-- שעליה בנוי עמוד האדמין החדש /admin/place-console ("Admin Places").
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- למה ישות נפרדת ולא שדה על destinations הקיימת:
-- destinations (מיגרציות 0005/0009/0023/0045) מייצגת עיר אחת. יעד יכול
-- להופיע באדמין בכמה "מהדורות" שונות בו-זמנית (ניו יורק בכריסמס +
-- ניו יורק בקיץ, לדוגמה) עם תמונה/תיאור/רשימת אטרקציות משלו לכל אחת -
-- זו בדיוק הסיבה שנבחרה האופציה של ישות עצמאית (destination_editions)
-- שמצביעה על destinations, ולא שדה subtitle בודד על destinations עצמה.
--
-- עקרון "לא לפגוע בקיים": שתי הטבלאות כאן חדשות לגמרי (create table),
-- אין שום שינוי לעמודה קיימת בשום טבלה אחרת.
-- ========================================================================

create table public.destination_editions (
  id uuid primary key default gen_random_uuid(),

  -- העיר הבסיסית - FK לטבלת destinations הקיימת. on delete cascade:
  -- מחיקת עיר בסיס מוחקת גם את המהדורות התמטיות שלה (לא את המקומות
  -- עצמם ב-places - ראו destination_edition_places למטה).
  destination_id uuid not null references public.destinations(id) on delete cascade,

  -- אחד מ-7 סוגי הטיול הקבועים ב-src/constants/quickCategories.ts
  -- (abroad / day_trip / weekend / nature_trip / restaurants_cafes /
  -- romantic_date / nightlife) - תחת איזו כרטיסייה בעמוד Admin Places
  -- המהדורה הזו מופיעה. נאכף באפליקציה/API, לא ב-CHECK, כדי לא לשכפל
  -- את רשימת הערכים בשתי שכבות (קוד + DB) שעלולות להתפצל.
  quick_category text not null,

  -- כותרת ותת-כותרת - למשל "ניו יורק" + "בכריסמס". title בברירת מחדל
  -- שם היעד הבסיסי (מולא באפליקציה בעת היצירה), אך ניתן לעריכה נפרדת.
  title text not null,
  subtitle text,

  image_url text,
  description text,
  weather_notes text,

  sort_order integer not null default 0,
  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- שיוך אטרקציות (places) למהדורה - many-to-many. מחיקת שורה מכאן היא
-- "הסרת שיוך בלבד" (כפי שסוכם) - היא לעולם לא מוחקת שורה מ-places עצמה.
create table public.destination_edition_places (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.destination_editions(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (edition_id, place_id)
);

create index destination_editions_destination_id_idx on public.destination_editions(destination_id);
create index destination_editions_quick_category_idx on public.destination_editions(quick_category);
create index destination_edition_places_edition_id_idx on public.destination_edition_places(edition_id);
create index destination_edition_places_place_id_idx on public.destination_edition_places(place_id);

alter table public.destination_editions enable row level security;
alter table public.destination_edition_places enable row level security;

-- קריאה למשתמשים מחוברים (עמוד ה-Web/אפליקציה, אם ישלוף מהמהדורות
-- האלה בעתיד) - כתיבה רק מהשרת (service_role, דרך /api/admin/*),
-- בדיוק כמו שאר טבלאות התוכן (places/destinations).
create policy "Authenticated users can view destination editions"
  on public.destination_editions for select
  to authenticated
  using (true);

create policy "Authenticated users can view destination edition places"
  on public.destination_edition_places for select
  to authenticated
  using (true);

create trigger set_destination_editions_updated_at
  before update on public.destination_editions
  for each row execute function public.set_updated_at();

comment on table public.destination_editions is
  'וריאנט תמטי/עונתי של יעד (עיר) - למשל "ניו יורק בכריסמס". כל וריאנט הוא רשומה עצמאית עם תמונה/תיאור/רשימת אטרקציות משלו, לפי החלטת המוצר מ-2026-08 (עמוד Admin Places).';
comment on table public.destination_edition_places is
  'שיוך many-to-many בין destination_editions לבין places. מחיקת שורה = הסרת שיוך בלבד, האטרקציה נשארת ב-places ובכל שיוך אחר שלה.';
