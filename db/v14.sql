create table if not exists provider_health (
 provider_id text primary key,
 name text not null,
 priority int not null default 0,
 capabilities jsonb not null default '[]'::jsonb,
 enabled boolean not null default true,
 last_success_at timestamptz,
 last_failure_at timestamptz,
 latency_ms numeric,
 error_rate numeric default 0,
 metadata jsonb not null default '{}'::jsonb,
 updated_at timestamptz default now()
);

create table if not exists data_quality_snapshots (
 id bigserial primary key,
 market_id text not null,
 quality_score numeric not null,
 grade text not null,
 freshness numeric,
 completeness numeric,
 agreement numeric,
 lineup_certainty numeric,
 duplicate_penalty numeric,
 reasons jsonb not null default '[]'::jsonb,
 created_at timestamptz default now()
);
create index if not exists data_quality_market_idx on data_quality_snapshots(market_id,created_at desc);

create table if not exists provider_failover_events (
 id bigserial primary key,
 capability text not null,
 from_provider text,
 to_provider text,
 reason text,
 created_at timestamptz default now()
);
