-- ========================================================================
-- Migration 0029: discovery_jobs - מעקב אחר כל חיפוש AI Discovery
-- (מפרט MASTER, סעיף 73). תוספת בלבד, לא נוגע בטבלאות קיימות.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references auth.users (id),

  trip_type text not null,
  categories text[] not null default '{}',
  filters jsonb not null default '{}',
  min_rating numeric not null default 4.0,
  requested_quantity int not null,

  -- מתמלא בסוף ריצת המנוע (עדיין לא קיים - זה רק רישום הבקשה כרגע)
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  found_count int not null default 0,
  rejected_count int not null default 0,
  duplicate_count int not null default 0,
  enriched_count int not null default 0,
  approved_count int not null default 0,
  needs_review_count int not null default 0,
  google_calls_used int not null default 0,
  google_calls_saved int not null default 0,

  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.discovery_jobs enable row level security;

create policy "Authenticated users can view discovery jobs"
  on public.discovery_jobs for select
  to authenticated
  using (true);

create index discovery_jobs_status_idx on public.discovery_jobs (status);
create index discovery_jobs_created_at_idx on public.discovery_jobs (created_at desc);
