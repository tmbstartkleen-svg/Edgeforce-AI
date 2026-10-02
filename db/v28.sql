-- Edgeforce V29: calibration, walk-forward backtesting, and controlled learned-weight promotion

alter table learned_model_weight_snapshots add column if not exists model_version text;
alter table learned_model_weight_snapshots add column if not exists holdout_sample_size int;
alter table learned_model_weight_snapshots add column if not exists brier_score numeric;
alter table learned_model_weight_snapshots add column if not exists log_loss numeric;
alter table learned_model_weight_snapshots add column if not exists roi numeric;
alter table learned_model_weight_snapshots add column if not exists confidence_label text;
alter table learned_model_weight_snapshots add column if not exists promoted boolean not null default false;
alter table learned_model_weight_snapshots add column if not exists reason text;

create table if not exists recalibration_runs (
  id bigserial primary key,
  model_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  prediction_rows int not null default 0,
  groups_evaluated int not null default 0,
  groups_promoted int not null default 0,
  groups_held int not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  error_text text
);

create index if not exists recalibration_runs_recent_idx
  on recalibration_runs(started_at desc);

create index if not exists learned_weight_promoted_idx
  on learned_model_weight_snapshots(promoted,model_name,sport,market_key,as_of desc);

alter table historical_predictions add column if not exists source_key text;
create unique index if not exists historical_predictions_source_key_idx
  on historical_predictions(source_key)
  where source_key is not null;

create index if not exists historical_predictions_model_lookup_idx
  on historical_predictions(model_name,sport,market_key,occurred_at desc);
