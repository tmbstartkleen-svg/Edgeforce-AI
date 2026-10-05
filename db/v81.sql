-- Edgeforce V69: market movement and closing-line learning

create table if not exists market_movement_snapshots (
  id bigserial primary key,
  sport text not null,
  event_id text not null,
  event_identity text not null,
  market_key text not null,
  selection_key text not null,
  canonical_market text not null,
  canonical_selection text not null,
  start_time timestamptz not null,
  opener_odds int,
  current_odds int,
  opener_probability numeric,
  current_probability numeric,
  probability_move numeric not null default 0,
  recent_probability_move numeric not null default 0,
  point_move numeric,
  velocity_per_hour numeric not null default 0,
  steam_signal numeric not null default 0,
  reversal_signal numeric not null default 0,
  closing_line_signal numeric not null default 0,
  movement_confidence numeric not null default 0,
  sharp_public_gap numeric,
  snapshot_count int not null default 0,
  observed_hour timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists market_movement_snapshots_event_hour_uidx
  on market_movement_snapshots(event_identity,canonical_market,canonical_selection,observed_hour);

create index if not exists market_movement_snapshots_recent_idx
  on market_movement_snapshots(sport,observed_hour desc);

create table if not exists market_movement_profiles (
  sport text not null,
  market_key text not null,
  sample_count int not null default 0,
  avg_clv_probability numeric not null default 0,
  positive_clv_rate numeric not null default 0,
  positive_clv_win_rate numeric not null default 0,
  negative_clv_win_rate numeric not null default 0,
  offered_brier numeric not null default 0,
  closing_brier numeric not null default 0,
  closing_skill numeric not null default 0,
  market_efficiency numeric not null default 0,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(sport,market_key)
);

create table if not exists market_movement_runs (
  id bigserial primary key,
  model_version text not null,
  settled_rows_read int not null default 0,
  profiles_written int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
