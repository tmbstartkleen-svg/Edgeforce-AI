-- Edgeforce V66: starting lineup and depth-chart intelligence

alter table player_game_stats
  add column if not exists starter boolean;

create table if not exists depth_chart_profiles (
  athlete_id text primary key references athletes(id) on delete cascade,
  sport text not null,
  team_key text not null,
  position_key text not null default '*',
  games int not null default 0,
  starts int not null default 0,
  starter_evidence_games int not null default 0,
  starter_rate numeric not null default 0,
  average_minutes numeric not null default 0,
  average_usage numeric not null default 0,
  role_score numeric not null default 0,
  depth_rank int not null default 99,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists depth_chart_profiles_team_idx
  on depth_chart_profiles(sport,team_key,position_key,depth_rank,updated_at desc);

create table if not exists live_lineup_snapshots (
  id bigserial primary key,
  athlete_id text references athletes(id) on delete cascade,
  player_name text not null,
  sport text not null,
  team_key text,
  event_id text,
  starter boolean,
  availability numeric,
  status text,
  source text not null default 'edgeforce-context',
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists live_lineup_snapshots_lookup_idx
  on live_lineup_snapshots(sport,team_key,player_name,observed_at desc);

create table if not exists depth_chart_runs (
  id bigserial primary key,
  model_version text not null,
  rows_read int not null default 0,
  profiles_written int not null default 0,
  teams_profiled int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
