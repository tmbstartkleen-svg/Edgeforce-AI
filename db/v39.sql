-- Edgeforce V51: prediction validation laboratory

create table if not exists validation_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  prediction_rows int not null default 0,
  groups_evaluated int not null default 0,
  evidence_passed int not null default 0,
  evidence_held int not null default 0,
  overall jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists validation_runs_recent_idx
  on validation_runs(started_at desc);

create table if not exists validation_snapshots (
  id bigserial primary key,
  validation_run_id bigint references validation_runs(id) on delete cascade,
  model_name text not null,
  sport text not null,
  market_key text not null,
  sample_size int not null default 0,
  holdout_sample_size int not null default 0,
  brier_score numeric not null default 0,
  log_loss numeric not null default 0,
  calibration_error numeric not null default 0,
  brier_skill_score numeric not null default 0,
  avg_clv numeric not null default 0,
  roi numeric not null default 0,
  walk_forward_folds int not null default 0,
  walk_forward_brier numeric not null default 0,
  context_brier_delta numeric,
  simulation_brier_delta numeric,
  evidence_grade text not null,
  promotion_eligible boolean not null default false,
  reason text,
  metrics jsonb not null default '{}'::jsonb,
  model_version text not null,
  as_of timestamptz not null default now()
);

create index if not exists validation_snapshots_group_recent_idx
  on validation_snapshots(model_name,sport,market_key,as_of desc);

create index if not exists validation_snapshots_promotion_recent_idx
  on validation_snapshots(promotion_eligible,evidence_grade,as_of desc);
