-- Edgeforce V70: cross-sport final probability and simulation weight optimizer

create table if not exists cross_sport_optimizer_profiles (
  sport text not null,
  market_key text not null,
  scope text not null check(scope in ('GLOBAL','SPORT','SPORT_MARKET')),
  sample_count int not null default 0,
  train_count int not null default 0,
  holdout_count int not null default 0,
  council_weight numeric not null default 0,
  simulation_weight numeric not null default 1,
  market_weight numeric not null default 0,
  prior_council_weight numeric not null default 0,
  prior_simulation_weight numeric not null default 1,
  prior_market_weight numeric not null default 0,
  train_brier numeric not null default 0,
  holdout_brier numeric not null default 0,
  baseline_holdout_brier numeric not null default 0,
  holdout_log_loss numeric not null default 0,
  baseline_holdout_log_loss numeric not null default 0,
  holdout_brier_gain numeric not null default 0,
  confidence numeric not null default 0,
  promoted boolean not null default false,
  reason text,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(sport,market_key)
);

create index if not exists cross_sport_optimizer_promoted_idx
  on cross_sport_optimizer_profiles(promoted,scope,sport,market_key,updated_at desc);

create table if not exists cross_sport_optimizer_runs (
  id bigserial primary key,
  model_version text not null,
  settled_rows_read int not null default 0,
  eligible_rows int not null default 0,
  profiles_written int not null default 0,
  profiles_promoted int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
