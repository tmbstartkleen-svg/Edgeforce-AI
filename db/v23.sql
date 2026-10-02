-- Edgeforce V23: automatic settlement, probability-band calibration and model learning

alter table bet_results add column if not exists simulation_probability numeric;
alter table bet_results add column if not exists model_probability numeric;
alter table bet_results add column if not exists simulation_mode text;
alter table bet_results add column if not exists probability_band text;
alter table bet_results add column if not exists unit_stake numeric default 1;
alter table bet_results add column if not exists result_source text;
alter table bet_results add column if not exists source_event_id text;
alter table bet_results add column if not exists raw jsonb default '{}'::jsonb;

create unique index if not exists bet_results_model_run_unique on bet_results(model_run_id) where model_run_id is not null;

create table if not exists event_results (
  id bigserial primary key,
  event_id text,
  provider_event_id text not null,
  sport text,
  home_team text not null,
  away_team text not null,
  home_score numeric not null,
  away_score numeric not null,
  completed boolean not null default true,
  provider text not null,
  source_timestamp timestamptz,
  raw jsonb default '{}'::jsonb,
  recorded_at timestamptz default now(),
  unique(provider,provider_event_id)
);
create index if not exists event_results_lookup_idx on event_results(event_id,recorded_at desc);

create table if not exists model_learning_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  sample_size int not null default 0,
  brier_score numeric,
  log_loss numeric,
  calibration_error numeric,
  roi numeric,
  avg_clv numeric,
  period_start date,
  period_end date,
  notes jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists calibration_band_metrics (
  id bigserial primary key,
  learning_run_id bigint references model_learning_runs(id) on delete cascade,
  model_version text not null,
  sport text not null,
  market_key text not null,
  band_label text not null,
  min_probability numeric not null,
  max_probability numeric not null,
  sample_size int not null,
  predicted_average numeric,
  hit_rate numeric,
  brier_score numeric,
  roi numeric,
  avg_clv numeric,
  period_start date,
  period_end date,
  as_of timestamptz not null default now()
);
create index if not exists calibration_band_lookup_idx on calibration_band_metrics(learning_run_id,sport,market_key,min_probability);
create index if not exists bet_results_learning_idx on bet_results(settled_at desc,probability_band,result);
