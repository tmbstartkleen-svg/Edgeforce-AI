-- Edgeforce V61: multi-challenger shadow league

drop index if exists external_ml_shadow_active_slot_uidx;

create table if not exists external_ml_shadow_leagues (
  id bigserial primary key,
  sport text not null,
  market_key text not null default '*',
  status text not null default 'ACTIVE',
  source_tournament_run_id bigint references external_ml_tournament_runs(id) on delete set null,
  max_challengers int not null default 4,
  min_competitors int not null default 2,
  winner_challenger_id bigint,
  winner_service_model_id text,
  winner_margin numeric,
  decision_reason text,
  model_version text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists external_ml_shadow_active_league_uidx
  on external_ml_shadow_leagues(sport,market_key)
  where status='ACTIVE';

alter table external_ml_shadow_challengers
  add column if not exists league_id bigint references external_ml_shadow_leagues(id) on delete set null,
  add column if not exists seed_rank int,
  add column if not exists league_rank int,
  add column if not exists league_score numeric,
  add column if not exists winner_margin numeric;

create index if not exists external_ml_shadow_challenger_league_idx
  on external_ml_shadow_challengers(league_id,status,league_rank,started_at desc);

alter table ml_shadow_recovery_runs
  add column if not exists leagues_checked int not null default 0,
  add column if not exists league_winners_ready int not null default 0;

alter table ml_shadow_recovery_snapshots
  add column if not exists league_id bigint references external_ml_shadow_leagues(id) on delete set null,
  add column if not exists league_rank int,
  add column if not exists league_score numeric,
  add column if not exists winner_margin numeric;

create index if not exists ml_shadow_recovery_snapshot_league_idx
  on ml_shadow_recovery_snapshots(league_id,observed_at desc);
