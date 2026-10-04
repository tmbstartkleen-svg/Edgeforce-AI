-- Edgeforce V60: shadow challenger live recovery engine

create table if not exists external_ml_shadow_challengers (
  id bigserial primary key,
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  service_model_id text not null,
  candidate_id bigint references external_ml_candidates(id) on delete set null,
  source_tournament_run_id bigint references external_ml_tournament_runs(id) on delete set null,
  status text not null default 'SHADOW',
  holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  holdout_calibration_error numeric not null default 0,
  holdout_brier_skill_score numeric not null default 0,
  composite_score numeric not null default 0,
  settled_sample_size int not null default 0,
  live_brier numeric,
  live_log_loss numeric,
  live_calibration_error numeric,
  market_brier numeric,
  native_brier numeric,
  market_brier_skill_score numeric,
  native_brier_skill_score numeric,
  brier_degradation numeric,
  confirmations int not null default 0,
  recovery_eligible boolean not null default false,
  decision_reason text,
  started_at timestamptz not null default now(),
  last_prediction_at timestamptz,
  last_evaluated_at timestamptz,
  completed_at timestamptz,
  model_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(service_model_id)
);

create unique index if not exists external_ml_shadow_active_slot_uidx
  on external_ml_shadow_challengers(sport,market_key)
  where status in ('SHADOW','READY_CONFIRM');

create index if not exists external_ml_shadow_status_idx
  on external_ml_shadow_challengers(status,sport,market_key,started_at desc);

create table if not exists external_ml_shadow_prediction_snapshots (
  id bigserial primary key,
  challenger_id bigint not null references external_ml_shadow_challengers(id) on delete cascade,
  market_id text not null,
  selection_key text not null,
  sport text not null,
  market_key text not null,
  algorithm text not null,
  service_model_id text not null,
  probability numeric not null,
  confidence numeric not null default 0,
  market_baseline_probability numeric not null,
  native_probability numeric not null,
  outcome smallint,
  closing_odds numeric,
  observed_at timestamptz not null default now(),
  settled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(challenger_id,market_id,market_key,selection_key)
);

create index if not exists external_ml_shadow_prediction_settled_idx
  on external_ml_shadow_prediction_snapshots(challenger_id,settled_at desc)
  where outcome is not null;

create table if not exists ml_shadow_recovery_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  challengers_checked int not null default 0,
  insufficient int not null default 0,
  shadow int not null default 0,
  ready_confirm int not null default 0,
  recovered int not null default 0,
  rejected int not null default 0,
  promotion_failed int not null default 0,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ml_shadow_recovery_runs_recent_idx
  on ml_shadow_recovery_runs(started_at desc);

create table if not exists ml_shadow_recovery_snapshots (
  id bigserial primary key,
  recovery_run_id bigint references ml_shadow_recovery_runs(id) on delete cascade,
  challenger_id bigint not null references external_ml_shadow_challengers(id) on delete cascade,
  sport text not null,
  market_key text not null,
  algorithm text not null,
  service_model_id text not null,
  state text not null,
  sample_size int not null default 0,
  live_brier numeric,
  live_log_loss numeric,
  live_calibration_error numeric,
  market_brier numeric,
  native_brier numeric,
  market_brier_skill_score numeric,
  native_brier_skill_score numeric,
  brier_degradation numeric,
  prior_confirmations int not null default 0,
  action text not null default 'NONE',
  reason text,
  metrics jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists ml_shadow_recovery_snapshot_group_idx
  on ml_shadow_recovery_snapshots(challenger_id,observed_at desc);
