-- Edgeforce V52: prediction-position intelligence ledger
-- Tracks manual/read-only Kalshi and Polymarket positions plus hourly decision marks.

create table if not exists prediction_positions (
  id bigserial primary key,
  venue text not null,
  contract_id text not null,
  title text not null,
  category text not null default 'OTHER',
  side text not null check (side in ('YES','NO')),
  quantity numeric not null check (quantity > 0),
  avg_entry_probability numeric not null check (avg_entry_probability > 0 and avg_entry_probability < 1),
  entry_fee numeric not null default 0,
  fair_probability_at_entry numeric,
  model_source text,
  opened_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  realized_pnl numeric,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists prediction_positions_open_idx
  on prediction_positions(status, opened_at desc);

create index if not exists prediction_positions_contract_idx
  on prediction_positions(venue, contract_id, status);

create table if not exists prediction_position_marks (
  id bigserial primary key,
  prediction_position_id bigint not null references prediction_positions(id) on delete cascade,
  observed_hour timestamptz not null,
  current_probability numeric,
  bid_probability numeric,
  ask_probability numeric,
  executable_exit_probability numeric,
  fair_probability numeric,
  fair_source text,
  fair_confidence numeric,
  remaining_edge numeric,
  unrealized_pnl numeric,
  action text not null,
  timing text not null,
  score int not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  unique (prediction_position_id, observed_hour)
);

create index if not exists prediction_position_marks_recent_idx
  on prediction_position_marks(prediction_position_id, observed_hour desc);

create index if not exists prediction_position_marks_action_idx
  on prediction_position_marks(action, observed_hour desc);
