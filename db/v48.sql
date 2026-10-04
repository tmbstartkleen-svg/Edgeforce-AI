-- Edgeforce V59: champion drift monitoring, quarantine, and native fallback

alter table external_ml_prediction_snapshots
  add column if not exists outcome smallint,
  add column if not exists settled_at timestamptz,
  add column if not exists closing_odds numeric,
  add column if not exists market_baseline_probability numeric;

alter table external_ml_champions
  add column if not exists active boolean not null default true,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists quarantined_at timestamptz,
  add column if not exists quarantine_reason text,
  add column if not exists last_monitor_at timestamptz,
  add column if not exists live_sample_size int not null default 0,
  add column if not exists live_brier numeric,
  add column if not exists live_log_loss numeric,
  add column if not exists live_calibration_error numeric,
  add column if not exists live_brier_skill_score numeric,
  add column if not exists live_drift_score numeric;

create index if not exists external_ml_prediction_settled_idx
  on external_ml_prediction_snapshots(service_model_id,settled_at desc)
  where outcome is not null;

create index if not exists external_ml_champions_active_idx
  on external_ml_champions(active,status,sport,market_key);

create table if not exists ml_champion_monitor_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  champions_checked int not null default 0,
  healthy int not null default 0,
  watch int not null default 0,
  critical int not null default 0,
  quarantined int not null default 0,
  insufficient int not null default 0,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ml_champion_monitor_runs_recent_idx
  on ml_champion_monitor_runs(started_at desc);

create table if not exists ml_champion_monitor_snapshots (
  id bigserial primary key,
  monitor_run_id bigint references ml_champion_monitor_runs(id) on delete cascade,
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  service_model_id text not null,
  state text not null,
  sample_size int not null default 0,
  recent_window int not null default 0,
  live_brier numeric,
  live_log_loss numeric,
  live_calibration_error numeric,
  live_brier_skill_score numeric,
  market_brier numeric,
  training_holdout_brier numeric,
  brier_degradation numeric,
  drift_score numeric not null default 0,
  prior_critical_runs int not null default 0,
  action text not null default 'NONE',
  reason text,
  metrics jsonb not null default '{}'::jsonb,
  model_version text not null,
  observed_at timestamptz not null default now()
);

create index if not exists ml_champion_monitor_snapshots_group_idx
  on ml_champion_monitor_snapshots(service_model_id,observed_at desc);

create index if not exists ml_champion_monitor_snapshots_state_idx
  on ml_champion_monitor_snapshots(state,observed_at desc);
