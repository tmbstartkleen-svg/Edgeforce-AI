-- Edgeforce V122 production observability snapshots

create table if not exists operational_health_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 overall_state text not null,
 health_score numeric not null,
 healthy_checks int not null,
 degraded_checks int not null,
 critical_checks int not null,
 unknown_checks int not null,
 db_latency_ms numeric,
 market_age_min numeric,
 consensus_age_min numeric,
 model_run_age_min numeric,
 automation_age_min numeric,
 action_incidents int not null default 0,
 watch_incidents int not null default 0,
 details jsonb not null default '{}'::jsonb
);

create index if not exists operational_health_snapshots_time_idx
 on operational_health_snapshots(observed_at desc);

create index if not exists operational_health_snapshots_state_idx
 on operational_health_snapshots(overall_state,observed_at desc);
