create table if not exists provider_ingestion_runs (
 id bigserial primary key,
 capability text not null,
 provider_id text,
 mode text not null,
 raw_count int not null default 0,
 normalized_count int not null default 0,
 warnings jsonb not null default '[]'::jsonb,
 attempts jsonb not null default '[]'::jsonb,
 started_at timestamptz not null default now(),
 completed_at timestamptz not null default now()
);

create index if not exists provider_ingestion_runs_capability_idx
 on provider_ingestion_runs(capability,completed_at desc);

alter table market_snapshots
 add column if not exists normalized_version text default 'edgeforce-v15';

create table if not exists provider_payload_audit (
 id bigserial primary key,
 provider_id text not null,
 capability text not null,
 status int,
 latency_ms numeric,
 ok boolean not null,
 error text,
 received_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists provider_payload_audit_provider_idx
 on provider_payload_audit(provider_id,received_at desc);
