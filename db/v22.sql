-- Edgeforce V22: multi-source live odds, true 10K simulation, weekly builder and cash ledger

alter table market_snapshots add column if not exists raw_implied_probability numeric;
alter table market_snapshots add column if not exists implied_probability numeric;
alter table market_snapshots add column if not exists no_vig_probability numeric;
alter table market_snapshots add column if not exists point numeric;
alter table market_snapshots add column if not exists source_timestamp timestamptz;
alter table market_snapshots add column if not exists data_quality numeric;

alter table model_runs add column if not exists simulation_probability numeric;
alter table model_runs add column if not exists simulation_ci_low numeric;
alter table model_runs add column if not exists simulation_ci_high numeric;
alter table model_runs add column if not exists simulation_mode text;
alter table model_runs add column if not exists prediction_probability numeric;

create table if not exists team_game_stats (
  id bigserial primary key,
  team_id text not null,
  event_id text not null,
  stat_date date not null,
  stats jsonb not null,
  source text,
  imported_at timestamptz default now(),
  unique(team_id,event_id)
);

create table if not exists lineup_snapshots (
  id bigserial primary key,
  event_id text not null,
  team_id text,
  confirmed boolean default false,
  starters jsonb default '[]'::jsonb,
  unavailable jsonb default '[]'::jsonb,
  source text,
  pulled_at timestamptz default now()
);

create table if not exists venue_coordinates (
  venue text primary key,
  latitude numeric,
  longitude numeric,
  roof_type text,
  timezone text,
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists daily_boards (
  id bigserial primary key,
  board_date date not null,
  generated_at timestamptz default now(),
  model_version text not null,
  payload jsonb not null,
  unique(board_date,model_version)
);

create table if not exists weekly_parlay_legs (
  id bigserial primary key,
  week_start date not null,
  market_id text not null,
  sport text not null,
  event text not null,
  selection text not null,
  market text not null,
  start_time timestamptz not null,
  odds int not null,
  sim_probability numeric not null,
  locked boolean default false,
  result text default 'pending',
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(week_start,market_id)
);
create index if not exists weekly_parlay_legs_week_idx on weekly_parlay_legs(week_start,start_time);

create table if not exists cash_transactions (
  id bigserial primary key,
  occurred_at timestamptz not null,
  platform text not null default 'DraftKings',
  transaction_type text not null check (transaction_type in ('deposit','withdrawal','fee','adjustment')),
  amount numeric not null,
  payment_method text,
  fee numeric default 0,
  source_reference text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists cash_transactions_time_idx on cash_transactions(occurred_at desc,platform,transaction_type);

create table if not exists settlement_history (
  id bigserial primary key,
  external_bet_id text,
  event_id text,
  market_id text,
  result text not null,
  stake numeric,
  returned numeric,
  pnl numeric,
  settled_at timestamptz not null,
  raw jsonb default '{}'::jsonb
);
