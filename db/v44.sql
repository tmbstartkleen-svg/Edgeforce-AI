-- Edgeforce V55: external ML algorithm tournament and champion registry

create table if not exists external_ml_tournament_runs (
  id bigserial primary key,
  model_version text not null,
  service_version text,
  status text not null default 'running',
  rows_exported int not null default 0,
  groups_requested int not null default 0,
  candidates_evaluated int not null default 0,
  champions_promoted int not null default 0,
  challengers_retained int not null default 0,
  algorithms jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists external_ml_tournament_runs_recent_idx
  on external_ml_tournament_runs(started_at desc);

create table if not exists external_ml_candidates (
  id bigserial primary key,
  tournament_run_id bigint references external_ml_tournament_runs(id) on delete cascade,
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  service_model_id text,
  role text not null default 'HELD',
  status text not null default 'EVALUATED',
  sample_size int not null default 0,
  train_size int not null default 0,
  calibration_size int not null default 0,
  holdout_size int not null default 0,
  holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  holdout_accuracy numeric not null default 0,
  market_baseline_brier numeric not null default 0,
  market_baseline_log_loss numeric not null default 0,
  brier_skill_score numeric not null default 0,
  calibration_error numeric not null default 0,
  composite_score numeric not null default 0,
  feature_names jsonb not null default '[]'::jsonb,
  feature_importance jsonb not null default '{}'::jsonb,
  hyperparameters jsonb not null default '{}'::jsonb,
  artifact_uri text,
  training_metadata jsonb not null default '{}'::jsonb,
  reason text,
  model_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists external_ml_candidates_group_idx
  on external_ml_candidates(sport,market_key,role,created_at desc);

create index if not exists external_ml_candidates_algorithm_idx
  on external_ml_candidates(algorithm,created_at desc);

create table if not exists external_ml_champions (
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  service_model_id text not null,
  candidate_id bigint references external_ml_candidates(id) on delete set null,
  artifact_uri text,
  composite_score numeric not null default 0,
  brier_skill_score numeric not null default 0,
  holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  calibration_error numeric not null default 0,
  promoted_at timestamptz not null default now(),
  model_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (sport,market_key)
);

create table if not exists external_ml_prediction_snapshots (
  id bigserial primary key,
  market_id text not null,
  sport text not null,
  market_key text not null,
  algorithm text not null,
  service_model_id text,
  probability numeric not null,
  confidence numeric not null default 0,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists external_ml_prediction_recent_idx
  on external_ml_prediction_snapshots(sport,market_key,observed_at desc);
