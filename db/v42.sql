-- Edgeforce V52: all-market prediction decision-signal history

create table if not exists prediction_signal_snapshots (
  id bigserial primary key,
  observed_hour timestamptz not null,
  signal_key text not null,
  venue text not null,
  contract_id text not null,
  source_venue text not null,
  source_contract_id text not null,
  title text not null,
  category text not null default 'OTHER',
  direction text not null,
  action text not null,
  score int not null default 0,
  evidence_grade text not null default 'C',
  match_quality text not null default 'HEURISTIC',
  similarity numeric not null default 0,
  fair_yes_probability numeric not null,
  fair_outcome_probability numeric not null,
  market_yes_probability numeric not null,
  execution_probability numeric not null,
  outcome_edge numeric not null,
  entry_probability numeric not null,
  take_profit_probability numeric not null,
  review_fair_probability numeric not null,
  spread_probability numeric,
  volume numeric,
  liquidity numeric,
  flow_support numeric not null default 0,
  momentum_support numeric not null default 0,
  smart_trader_support numeric not null default 0,
  risk_flags jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  final_outcome boolean,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (signal_key, observed_hour)
);

create index if not exists prediction_signal_snapshots_recent_idx
  on prediction_signal_snapshots(observed_hour desc);

create index if not exists prediction_signal_snapshots_action_idx
  on prediction_signal_snapshots(action, evidence_grade, score desc, observed_hour desc);

create index if not exists prediction_signal_snapshots_contract_idx
  on prediction_signal_snapshots(venue, contract_id, observed_hour desc);

create index if not exists prediction_signal_snapshots_category_idx
  on prediction_signal_snapshots(category, action, observed_hour desc);
