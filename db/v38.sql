-- Edgeforce V42: champion/challenger model governance and drift controls

create table if not exists model_governance_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  prediction_rows int not null default 0,
  groups_evaluated int not null default 0,
  champions int not null default 0,
  challengers int not null default 0,
  watch_count int not null default 0,
  drifting_count int not null default 0,
  critical_count int not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists model_governance_runs_recent_idx
  on model_governance_runs(started_at desc);

create table if not exists model_governance_snapshots (
  id bigserial primary key,
  model_name text not null,
  sport text not null,
  market_key text not null,
  role text not null,
  drift_status text not null,
  baseline_sample_size int not null default 0,
  recent_sample_size int not null default 0,
  psi numeric not null default 0,
  mean_probability_shift numeric not null default 0,
  brier_delta numeric not null default 0,
  log_loss_delta numeric not null default 0,
  calibration_delta numeric not null default 0,
  avg_clv_delta numeric not null default 0,
  recent_brier_score numeric not null default 0,
  recent_log_loss numeric not null default 0,
  recent_calibration_error numeric not null default 0,
  recent_decayed_score numeric not null default 0,
  score numeric not null default 0,
  effective_score numeric not null default 0,
  weight_brake numeric not null default 1,
  runtime_multiplier numeric not null default 1,
  reason text,
  model_version text not null,
  as_of timestamptz not null default now()
);

create index if not exists model_governance_group_recent_idx
  on model_governance_snapshots(sport,market_key,role,as_of desc);

create index if not exists model_governance_drift_recent_idx
  on model_governance_snapshots(drift_status,as_of desc);

create index if not exists model_governance_model_recent_idx
  on model_governance_snapshots(model_name,sport,market_key,as_of desc);
