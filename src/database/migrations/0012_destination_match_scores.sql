-- ========================================================================
-- Migration 0012: destination_match_scores - מטמון (cache) לציוני ההתאמה
-- לא מחשבים מחדש בכל רענון - רק כשה-DNA או היעד עצמו השתנו.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.destination_match_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination_id uuid not null references public.destinations (id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  reason text not null,
  source text not null default 'ai' check (source in ('ai', 'fallback')),
  dna_updated_at timestamptz not null,
  computed_at timestamptz not null default now(),
  unique (user_id, destination_id)
);

alter table public.destination_match_scores enable row level security;

create policy "Users can view their own match scores"
  on public.destination_match_scores for select
  using (auth.uid() = user_id);

create policy "Users can insert their own match scores"
  on public.destination_match_scores for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own match scores"
  on public.destination_match_scores for update
  using (auth.uid() = user_id);
