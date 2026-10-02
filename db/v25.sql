-- Edgeforce V25: automatic pregame change detection and re-simulation tracking

create table if not exists pregame_change_events (
  id bigserial primary key,
  signature text not null unique,
  event_id text not null,
  market_id text not null,
  market_key text not null,
  selection_key text not null,
  sport text not null,
  severity text not null,
  reasons jsonb not null default '[]'::jsonb,
  previous_run_id bigint,
  previous_simulation_probability numeric,
  current_simulation_probability numeric,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);
create index if not exists pregame_change_event_idx on pregame_change_events(event_id,detected_at desc);
create index if not exists pregame_change_market_idx on pregame_change_events(market_id,detected_at desc);

alter table weekly_parlay_legs add column if not exists original_odds int;
alter table weekly_parlay_legs add column if not exists original_sim_probability numeric;
alter table weekly_parlay_legs add column if not exists current_odds int;
alter table weekly_parlay_legs add column if not exists current_sim_probability numeric;
alter table weekly_parlay_legs add column if not exists needs_review boolean default false;
alter table weekly_parlay_legs add column if not exists change_summary jsonb default '[]'::jsonb;

update weekly_parlay_legs set
  original_odds=coalesce(original_odds,odds),
  original_sim_probability=coalesce(original_sim_probability,sim_probability),
  current_odds=coalesce(current_odds,odds),
  current_sim_probability=coalesce(current_sim_probability,sim_probability)
where original_odds is null or original_sim_probability is null or current_odds is null or current_sim_probability is null;
