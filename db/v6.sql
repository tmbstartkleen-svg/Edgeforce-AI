alter table market_snapshots add column if not exists implied_probability numeric;
alter table market_snapshots add column if not exists no_vig_probability numeric;
alter table market_snapshots add column if not exists source_age_seconds int;
alter table model_runs add column if not exists simulation_probability numeric;
alter table model_runs add column if not exists simulation_ci_low numeric;
alter table model_runs add column if not exists simulation_ci_high numeric;
alter table model_runs add column if not exists repricing_context jsonb default '{}'::jsonb;
alter table bet_results add column if not exists stake numeric;
alter table bet_results add column if not exists model_probability numeric;

create table if not exists ingestion_runs (
  id bigserial primary key,
  feed_type text not null,
  provider text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text not null default 'running',
  records_seen int default 0,
  records_written int default 0,
  error_text text,
  metadata jsonb default '{}'::jsonb
);

create table if not exists model_weights (
  id bigserial primary key,
  model_version text not null,
  sport text not null,
  market_key text not null,
  model_name text not null,
  weight numeric not null,
  sample_size int default 0,
  brier_score numeric,
  calibration_error numeric,
  updated_at timestamptz default now(),
  unique(model_version,sport,market_key,model_name)
);

create table if not exists player_features (
  athlete_id text not null,
  as_of timestamptz not null,
  sport text not null,
  features jsonb not null,
  source_window text,
  primary key(athlete_id,as_of)
);
