-- Edgeforce V31: automatic context-change resimulation and repricing

create table if not exists context_change_events (
  id bigserial primary key,
  change_key text not null unique,
  market_id text not null,
  event_name text,
  selection text,
  sport text,
  change_type text not null,
  severity text not null,
  reason text not null,
  before_value jsonb,
  after_value jsonb,
  requires_resimulation boolean not null default true,
  detected_at timestamptz not null default now()
);

create index if not exists context_change_events_detected_idx
  on context_change_events(detected_at desc);

create index if not exists context_change_events_market_idx
  on context_change_events(market_id,detected_at desc);

create table if not exists context_market_states (
  market_identity text primary key,
  market_id text not null,
  snapshot jsonb not null,
  revision text not null,
  updated_at timestamptz not null default now()
);

create index if not exists context_market_states_updated_idx
  on context_market_states(updated_at desc);
