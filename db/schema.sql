create extension if not exists pgcrypto;

create table if not exists teams (
  id text primary key,
  sport text not null,
  league text,
  name text not null,
  city text,
  venue text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists athletes (
  id text primary key,
  sport text not null,
  league text,
  full_name text not null,
  team_id text,
  position text,
  active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists events (
  id text primary key,
  provider_event_id text unique,
  sport text not null,
  league text,
  home_team_id text,
  away_team_id text,
  start_time timestamptz not null,
  venue text,
  status text default 'scheduled',
  created_at timestamptz default now()
);
create index if not exists events_time_idx on events(start_time,sport,league);

create table if not exists market_snapshots (
  id bigserial primary key,
  event_id text not null,
  provider text not null,
  bookmaker text not null,
  market_key text not null,
  selection_key text not null,
  american_odds int not null,
  point numeric,
  pulled_at timestamptz default now(),
  raw jsonb default '{}'::jsonb
);
create index if not exists market_lookup_idx on market_snapshots(event_id,market_key,selection_key,pulled_at desc);

create table if not exists player_game_stats (
  id bigserial primary key,
  athlete_id text not null,
  event_id text not null,
  stat_date date not null,
  stats jsonb not null,
  source text,
  imported_at timestamptz default now(),
  unique(athlete_id,event_id)
);

create table if not exists injury_snapshots (
  id bigserial primary key,
  athlete_id text,
  team_id text,
  status text,
  detail text,
  source text,
  reported_at timestamptz,
  pulled_at timestamptz default now()
);

create table if not exists weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  temp_f numeric,
  wind_mph numeric,
  precip_prob numeric,
  humidity numeric,
  roof_status text,
  payload jsonb default '{}'::jsonb,
  pulled_at timestamptz default now()
);

create table if not exists model_runs (
  id bigserial primary key,
  event_id text not null,
  market_key text not null,
  selection_key text not null,
  model_version text not null default 'edgeforce-v4',
  run_count int not null,
  market_probability numeric not null,
  model_probability numeric not null,
  fair_american_odds int,
  expected_value numeric,
  full_kelly numeric,
  fractional_kelly numeric,
  agreement numeric,
  confidence numeric,
  grade text,
  feature_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists model_runs_rank_idx on model_runs(created_at desc, expected_value desc, confidence desc);

create table if not exists bet_results (
  id bigserial primary key,
  model_run_id bigint references model_runs(id),
  event_id text,
  market_key text,
  selection_key text,
  offered_odds int,
  closing_odds int,
  result text,
  clv numeric,
  pnl numeric,
  settled_at timestamptz
);

create table if not exists calibration_metrics (
  id bigserial primary key,
  model_version text,
  sport text,
  market_key text,
  sample_size int,
  brier_score numeric,
  log_loss numeric,
  calibration_error numeric,
  period_start date,
  period_end date,
  created_at timestamptz default now()
);
