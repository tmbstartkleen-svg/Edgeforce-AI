-- Edgeforce V54: trained sport-specific ML model registry and training audit

create table if not exists trained_model_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  rows_seen int not null default 0,
  groups_evaluated int not null default 0,
  artifacts_trained int not null default 0,
  artifacts_promoted int not null default 0,
  sports jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists trained_model_runs_recent_idx
  on trained_model_runs(started_at desc);

create table if not exists trained_model_artifacts (
  id bigserial primary key,
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  artifact_version text not null,
  feature_names jsonb not null,
  coefficients jsonb not null,
  intercept numeric not null default 0,
  scaler_means jsonb not null,
  scaler_scales jsonb not null,
  calibration_a numeric not null default 1,
  calibration_b numeric not null default 0,
  sample_size int not null default 0,
  train_size int not null default 0,
  calibration_size int not null default 0,
  holdout_size int not null default 0,
  train_brier numeric not null default 0,
  holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  holdout_accuracy numeric not null default 0,
  market_baseline_brier numeric not null default 0,
  market_baseline_log_loss numeric not null default 0,
  brier_skill_score numeric not null default 0,
  calibration_error numeric not null default 0,
  promoted boolean not null default false,
  promotion_reason text,
  feature_importance jsonb not null default '{}'::jsonb,
  train_start timestamptz,
  train_end timestamptz,
  holdout_start timestamptz,
  holdout_end timestamptz,
  model_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists trained_model_artifacts_lookup_idx
  on trained_model_artifacts(sport,market_key,promoted,created_at desc);

create index if not exists trained_model_artifacts_promoted_idx
  on trained_model_artifacts(promoted,created_at desc);

create table if not exists trained_model_prediction_snapshots (
  id bigserial primary key,
  market_id text not null,
  sport text not null,
  market_key text not null,
  artifact_id bigint references trained_model_artifacts(id) on delete set null,
  algorithm text not null,
  probability numeric not null,
  confidence numeric not null default 0,
  feature_coverage numeric not null default 0,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists trained_model_prediction_recent_idx
  on trained_model_prediction_snapshots(sport,market_key,observed_at desc);
