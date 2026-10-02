-- Edgeforce V24: player-prop settlement and prop-specific calibration

alter table bet_results add column if not exists player_name text;
alter table bet_results add column if not exists prop_type text;
alter table bet_results add column if not exists actual_value numeric;

create table if not exists player_result_snapshots (
  id bigserial primary key,
  provider_event_id text,
  sport text,
  player_name text not null,
  team_name text,
  stats jsonb not null default '{}'::jsonb,
  provider text not null,
  source_timestamp timestamptz,
  raw jsonb default '{}'::jsonb,
  recorded_at timestamptz default now()
);
create index if not exists player_result_lookup_idx on player_result_snapshots(player_name,provider_event_id,recorded_at desc);

create table if not exists prop_performance_metrics (
  id bigserial primary key,
  model_version text not null,
  sport text not null,
  prop_type text not null,
  sample_size int not null,
  predicted_average numeric,
  hit_rate numeric,
  brier_score numeric,
  roi numeric,
  avg_clv numeric,
  calibration_error numeric,
  as_of timestamptz not null default now()
);
create index if not exists prop_performance_lookup_idx on prop_performance_metrics(sport,prop_type,as_of desc);
create index if not exists bet_results_prop_learning_idx on bet_results(prop_type,settled_at desc,result);
