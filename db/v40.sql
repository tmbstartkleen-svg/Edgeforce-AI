-- Edgeforce prediction-market intelligence warehouse
-- Persists current contract state, hourly probability history, public trade tape,
-- and observed trader behavior for Kalshi / Polymarket analytics.

create table if not exists prediction_market_state (
  venue text not null,
  contract_id text not null,
  title text not null,
  category text not null default 'OTHER',
  yes_probability numeric not null,
  bid_probability numeric,
  ask_probability numeric,
  volume numeric,
  liquidity numeric,
  expires_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (venue, contract_id)
);

create index if not exists prediction_market_state_category_idx
  on prediction_market_state(category, updated_at desc);

create index if not exists prediction_market_state_updated_idx
  on prediction_market_state(updated_at desc);

create table if not exists prediction_market_snapshots (
  id bigserial primary key,
  venue text not null,
  contract_id text not null,
  title text not null,
  category text not null default 'OTHER',
  yes_probability numeric not null,
  bid_probability numeric,
  ask_probability numeric,
  volume numeric,
  liquidity numeric,
  observed_hour timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  unique (venue, contract_id, observed_hour)
);

alter table prediction_market_snapshots add column if not exists venue text;
alter table prediction_market_snapshots add column if not exists bid_probability numeric;
alter table prediction_market_snapshots add column if not exists ask_probability numeric;
alter table prediction_market_snapshots add column if not exists liquidity numeric;
alter table prediction_market_snapshots add column if not exists observed_hour timestamptz;

update prediction_market_snapshots
set venue=coalesce(venue, provider, 'legacy')
where venue is null;

update prediction_market_snapshots
set observed_hour=coalesce(observed_hour, pulled_at, now())
where observed_hour is null;

alter table prediction_market_snapshots alter column venue set not null;
alter table prediction_market_snapshots alter column observed_hour set not null;

do $
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='prediction_market_snapshots_venue_contract_hour_key'
  ) then
    alter table prediction_market_snapshots
      add constraint prediction_market_snapshots_venue_contract_hour_key
      unique (venue, contract_id, observed_hour);
  end if;
end
$;

create index if not exists prediction_market_snapshots_lookup_idx
  on prediction_market_snapshots(venue, contract_id, observed_hour desc);

create index if not exists prediction_market_snapshots_hour_idx
  on prediction_market_snapshots(observed_hour desc);

create table if not exists prediction_trade_tape (
  venue text not null,
  trade_id text not null,
  market_id text not null,
  title text not null,
  trader_id text,
  direction text not null,
  price numeric not null,
  size numeric not null default 0,
  notional numeric not null default 0,
  signed_yes_flow numeric not null default 0,
  traded_at timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  primary key (venue, trade_id)
);

create index if not exists prediction_trade_tape_market_idx
  on prediction_trade_tape(venue, market_id, traded_at desc);

create index if not exists prediction_trade_tape_trader_idx
  on prediction_trade_tape(venue, trader_id, traded_at desc)
  where trader_id is not null;

create index if not exists prediction_trade_tape_time_idx
  on prediction_trade_tape(traded_at desc);

create table if not exists prediction_trader_profiles (
  venue text not null,
  trader_id text not null,
  trades_observed int not null default 0,
  notional_observed numeric not null default 0,
  avg_trade_notional numeric not null default 0,
  max_trade_notional numeric not null default 0,
  net_yes_flow numeric not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  public_rank int,
  public_pnl numeric,
  public_volume numeric,
  public_market_count int,
  public_biggest_win numeric,
  public_name text,
  verified boolean,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (venue, trader_id)
);

create index if not exists prediction_trader_profiles_score_idx
  on prediction_trader_profiles(public_pnl desc nulls last, notional_observed desc);
