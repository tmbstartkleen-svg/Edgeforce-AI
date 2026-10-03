-- Edgeforce V37: multi-provider consensus pricing and market structure

create table if not exists market_consensus_snapshots (
  id bigserial primary key,
  event_id text not null,
  market_key text not null,
  selection_key text not null,
  start_time timestamptz,
  target_book text,
  target_odds int,
  target_book_found boolean not null default false,
  consensus_probability numeric not null,
  consensus_fair_odds int,
  provider_count int not null default 0,
  book_count int not null default 0,
  dispersion numeric not null default 0,
  agreement numeric not null default 0,
  min_probability numeric,
  max_probability numeric,
  best_odds int,
  best_book text,
  sharp_probability numeric,
  public_probability numeric,
  sharp_public_gap numeric,
  market_structure text,
  outlier_books jsonb not null default '[]'::jsonb,
  books jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists market_consensus_recent_idx
  on market_consensus_snapshots(event_id,market_key,selection_key,captured_at desc);

create index if not exists market_consensus_structure_idx
  on market_consensus_snapshots(market_structure,agreement desc,captured_at desc);

create index if not exists market_consensus_dispersion_idx
  on market_consensus_snapshots(dispersion desc,captured_at desc);
