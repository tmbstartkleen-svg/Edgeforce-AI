-- Edgeforce V58: first champion tournament evidence and champion history

create table if not exists ml_first_tournament_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  tournament_run_id bigint,
  activation_state text,
  service_version text,
  candidates_evaluated int not null default 0,
  champions_before int not null default 0,
  champions_after int not null default 0,
  champion_changes int not null default 0,
  sports_covered int not null default 0,
  artifacts_verified int not null default 0,
  artifacts_missing int not null default 0,
  leaderboard jsonb not null default '[]'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  artifact_verification jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ml_first_tournament_runs_recent_idx
  on ml_first_tournament_runs(started_at desc);

create table if not exists external_ml_champion_history (
  id bigserial primary key,
  tournament_run_id bigint,
  sport text not null,
  market_key text not null default '*',
  algorithm text not null,
  service_model_id text not null,
  action text not null,
  composite_score numeric not null default 0,
  brier_skill_score numeric not null default 0,
  holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  calibration_error numeric not null default 0,
  reason text,
  model_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists external_ml_champion_history_group_idx
  on external_ml_champion_history(sport,market_key,recorded_at desc);
