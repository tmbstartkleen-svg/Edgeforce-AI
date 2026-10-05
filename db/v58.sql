-- Edgeforce V109 best-price and execution-quality history

create table if not exists best_price_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 current_venue text,
 best_venue text,
 current_probability numeric not null,
 best_probability numeric not null,
 current_american_odds int,
 best_american_odds int,
 price_improvement_points numeric not null,
 equivalent_confidence numeric not null,
 freshness_score numeric not null,
 liquidity_score numeric not null,
 spread_score numeric not null,
 execution_quality text not null,
 execution_score numeric not null,
 stale boolean not null default false,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists best_price_snapshots_lookup_idx
 on best_price_snapshots(opportunity_id,observed_at desc);

create index if not exists best_price_snapshots_quality_idx
 on best_price_snapshots(execution_quality,observed_at desc);
