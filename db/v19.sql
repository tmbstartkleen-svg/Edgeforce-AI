create table if not exists closing_line_snapshots (
 id bigserial primary key,
 event_id text not null,
 market_key text not null,
 selection_key text not null,
 provider_id text,
 closing_odds int not null,
 closing_probability numeric,
 captured_at timestamptz not null default now()
);
create index if not exists closing_line_lookup_idx on closing_line_snapshots(event_id,market_key,selection_key,captured_at desc);

create table if not exists provider_reconciliation_snapshots (
 id bigserial primary key,
 market_id text not null,
 reconciled_probability numeric not null,
 reconciled_odds int,
 agreement numeric,
 dispersion numeric,
 providers int,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists provider_reconciliation_market_idx on provider_reconciliation_snapshots(market_id,created_at desc);
