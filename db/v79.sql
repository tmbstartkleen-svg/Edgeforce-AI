-- Edgeforce V67: schedule, rest, travel and fatigue intelligence

create table if not exists schedule_fatigue_snapshots (
  id bigserial primary key,
  sport text not null,
  event_id text not null,
  event_name text,
  start_time timestamptz not null,
  home text not null,
  away text not null,
  home_rest_days numeric,
  away_rest_days numeric,
  home_travel_miles numeric not null default 0,
  away_travel_miles numeric not null default 0,
  home_timezone_shift numeric not null default 0,
  away_timezone_shift numeric not null default 0,
  home_fatigue numeric not null default 0,
  away_fatigue numeric not null default 0,
  rest_edge numeric not null default 0,
  travel_edge numeric not null default 0,
  fatigue_edge numeric not null default 0,
  density_edge numeric not null default 0,
  composite_edge numeric not null default 0,
  confidence numeric not null default 0,
  observed_hour timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists schedule_fatigue_snapshots_event_hour_uidx
  on schedule_fatigue_snapshots(sport,event_id,observed_hour);

create index if not exists schedule_fatigue_snapshots_recent_idx
  on schedule_fatigue_snapshots(sport,observed_hour desc);

create table if not exists schedule_fatigue_profiles (
  sport text primary key,
  sample_count int not null default 0,
  avg_abs_rest_edge numeric not null default 0,
  avg_abs_travel_edge numeric not null default 0,
  avg_abs_fatigue_edge numeric not null default 0,
  avg_abs_density_edge numeric not null default 0,
  avg_abs_composite_edge numeric not null default 0,
  avg_confidence numeric not null default 0,
  high_load_rate numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists schedule_fatigue_runs (
  id bigserial primary key,
  model_version text not null,
  snapshots_read int not null default 0,
  profiles_written int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
