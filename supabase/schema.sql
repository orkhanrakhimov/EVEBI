-- EVEBI station reviews. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  station_id text not null check (char_length(station_id) between 3 and 80),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  status text check (status in ('worked','failed','partial')),
  comment text check (comment is null or char_length(comment) <= 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, user_id),
  check (rating is not null or status is not null or comment is not null)
);

alter table public.reviews enable row level security;

drop policy if exists "read visible" on public.reviews;
drop policy if exists "insert own" on public.reviews;
drop policy if exists "update own" on public.reviews;
drop policy if exists "delete own" on public.reviews;
create policy "read visible" on public.reviews for select using (hidden = false);
create policy "insert own" on public.reviews for insert to authenticated with check (user_id = auth.uid() and hidden = false);
create policy "update own" on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and hidden = false);
create policy "delete own" on public.reviews for delete to authenticated using (user_id = auth.uid());

-- public aggregates per station (no personal data)
create or replace view public.station_stats as
select station_id,
       round(avg(rating)::numeric, 1) as avg_rating,
       count(rating) as rating_count,
       count(*) filter (where status = 'worked') as worked,
       count(*) filter (where status = 'failed' and updated_at > now() - interval '30 days') as failed_30d,
       max(updated_at) filter (where status = 'worked') as last_worked
from public.reviews
where hidden = false
group by station_id;

grant select on public.reviews to anon, authenticated;
grant select on public.station_stats to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

-- per-user saved data (car, settings, home/work, saved routes) so it follows the user across devices
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "own data read" on public.user_data;
drop policy if exists "own data insert" on public.user_data;
drop policy if exists "own data update" on public.user_data;
drop policy if exists "own data delete" on public.user_data;
create policy "own data read" on public.user_data for select to authenticated using (user_id = auth.uid());
create policy "own data insert" on public.user_data for insert to authenticated with check (user_id = auth.uid());
create policy "own data update" on public.user_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own data delete" on public.user_data for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.user_data to authenticated;
