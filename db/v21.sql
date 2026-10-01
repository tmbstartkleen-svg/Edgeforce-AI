-- Edgeforce V21: screenshot history, prediction markets, anomaly intelligence

create table if not exists bet_slips (
  id text primary key,
  placed_at timestamptz not null,
  source text not null default 'manual',
  confidence text not null default 'confirmed',
  sport text,
  leg_count int not null,
  stake numeric not null,
  returned numeric not null default 0,
  result text not null,
  notes text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists bet_legs (
  id bigserial primary key,
  bet_slip_id text not null references bet_slips(id) on delete cascade,
  ordinal int not null,
  sport text,
  market_type text,
  selection text not null,
  result text not null default 'unknown',
  offered_odds int,
  event_id text,
  athlete_id text,
  metadata jsonb default '{}'::jsonb,
  unique(bet_slip_id,ordinal)
);

create index if not exists bet_slips_performance_idx on bet_slips(placed_at desc,sport,leg_count,result);
create index if not exists bet_legs_performance_idx on bet_legs(sport,market_type,result);

create table if not exists prediction_market_snapshots (
  id bigserial primary key,
  provider text not null,
  contract_id text not null,
  title text not null,
  category text,
  yes_probability numeric not null,
  no_probability numeric not null,
  model_probability numeric,
  probability_difference numeric,
  volume numeric,
  expires_at timestamptz,
  pulled_at timestamptz default now(),
  raw jsonb default '{}'::jsonb
);

create index if not exists prediction_market_lookup_idx on prediction_market_snapshots(contract_id,pulled_at desc);

create table if not exists anomaly_signals (
  id bigserial primary key,
  event_id text,
  market_key text,
  selection_key text,
  sport text,
  score numeric not null,
  severity text not null,
  reason text not null,
  feature_snapshot jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists anomaly_signals_rank_idx on anomaly_signals(created_at desc,score desc);
