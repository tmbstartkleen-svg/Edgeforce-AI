-- Intelligence Core additive warehouse, version 119.
-- Read/write adapters are intentionally not enabled by this migration.
create table if not exists intelligence_sources (
 source_id text primary key,
 upstream_id text not null,
 source_type text not null,
 enabled boolean not null default false,
 license_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists intelligence_sources_upstream_idx on intelligence_sources(upstream_id);

create table if not exists intelligence_entity_keys (
 entity_kind text not null check(entity_kind in ('event','team','player','market')),
 canonical_id text not null,
 source_id text not null references intelligence_sources(source_id),
 vendor_id text not null,
 resolution_status text not null default 'PENDING' check(resolution_status in ('PENDING','VERIFIED','REJECTED')),
 created_at timestamptz not null default now(),
 primary key(entity_kind,source_id,vendor_id)
);
create index if not exists intelligence_entity_canonical_idx on intelligence_entity_keys(entity_kind,canonical_id);

create table if not exists intelligence_observations (
 observation_id bigint generated always as identity primary key,
 source_id text not null references intelligence_sources(source_id),
 upstream_id text not null,
 event_id text not null,
 market_id text,
 observation_kind text not null check(observation_kind in ('score','odds','injury','lineup','player-stat','weather','prediction-market','result')),
 observed_at timestamptz not null,
 ingested_at timestamptz not null default now(),
 payload_hash text not null,
 payload jsonb not null,
 unique(source_id,event_id,observation_kind,observed_at,payload_hash)
);
create index if not exists intelligence_observations_event_time_idx
 on intelligence_observations(event_id,observation_kind,observed_at desc);
create index if not exists intelligence_observations_ingested_idx on intelligence_observations(ingested_at desc);

create table if not exists intelligence_agent_runs (
 run_id bigint generated always as identity primary key,
 agent_id text not null,
 run_key text not null unique,
 status text not null check(status in ('PLANNED','RUNNING','SUCCEEDED','FAILED','SKIPPED')),
 scheduled_at timestamptz not null,
 started_at timestamptz,
 finished_at timestamptz,
 lease_until timestamptz,
 attempt_count integer not null default 0 check(attempt_count>=0),
 budget_units integer not null default 0 check(budget_units>=0),
 error_summary text,
 created_at timestamptz not null default now()
);
create index if not exists intelligence_agent_runs_status_idx
 on intelligence_agent_runs(status,scheduled_at desc);

create table if not exists intelligence_model_forecasts (
 forecast_id bigint generated always as identity primary key,
 event_id text not null,
 market_id text not null,
 model_id text not null,
 model_version text not null,
 probability numeric not null check(probability>=0 and probability<=1),
 computed_at timestamptz not null default now(),
 inputs_cutoff_at timestamptz not null,
 evidence_count integer not null default 0 check(evidence_count>=0),
 calibration_status text not null default 'UNVERIFIED',
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists intelligence_model_forecasts_lookup_idx
 on intelligence_model_forecasts(event_id,market_id,computed_at desc);
