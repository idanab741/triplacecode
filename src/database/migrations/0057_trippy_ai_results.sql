-- ========================================================================
-- Migration 0057: trippy_ai_results table
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================
--
-- *** תיקון אדריכלי (בקשה מפורשת - "לא צריך שום טבלה משותפת - צריך
-- טבלה חדשה - trippy AI"): עד עכשיו תוצאות הצ'אט המהיר (trippy-quick,
-- ר' /api/trip-builder/trippy-quick/route.ts) נשמרו בטבלה
-- trip_builder_sessions - **אותה טבלה בדיוק** שבה נשמרים טיולי יום/
-- חופשות "אמיתיים" מהאשף המלא - עם trip_type="day_trip" מזויף (אין
-- ערך ייעודי ב-enum הקיים), מה שגרם לתוצאות טיול-מהיר להתערבב עם
-- טיולים אמיתיים בעמוד "הטיולים שלי". טבלה נפרדת לגמרי, עם המבנה
-- הפשוט שבאמת מתאים לזרימה הזו (מערך תחנות שטוח, לא FinalItinerary
-- מלא עם שדות מזויפים כמו dayIndex/arrivalOffsetMinutes).

create table public.trippy_ai_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'המסלול שלכם',
  free_text text not null,
  -- מערך התחנות השטוח (TrippyQuickStop[] - ר' trippyQuickShared.ts),
  -- לא FinalItinerary. עד 4 תחנות (ר' route.ts - MAX_TOTAL_STOPS).
  stops jsonb not null default '[]'::jsonb,
  -- {city, lat, lng} - המיקום שבו בוצע החיפוש בפועל, לצורך "החלף" (swap).
  search_context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trippy_ai_results enable row level security;

create policy "Users can view their own trippy AI results"
  on public.trippy_ai_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trippy AI results"
  on public.trippy_ai_results for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trippy AI results"
  on public.trippy_ai_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trippy AI results"
  on public.trippy_ai_results for delete
  using (auth.uid() = user_id);

create index trippy_ai_results_user_id_created_at_idx
  on public.trippy_ai_results (user_id, created_at desc);

comment on table public.trippy_ai_results is
  'תוצאות של הצ''אט המהיר (trippy-quick, מלל חופשי -> Claude -> DB) - נפרד לגמרי מ-trip_builder_sessions (טיולי יום/חופשה מהאשף המלא), כדי שלא יתערבבו בעמוד "הטיולים שלי".';
