create table if not exists runtime_incidents (
 id bigserial primary key,
 severity text not null,
 event_type text not null,
 message text not null,
 request_id text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists runtime_incidents_open_idx on runtime_incidents(resolved_at,created_at desc);

create table if not exists performance_samples (
 id bigserial primary key,
 route text not null,
 duration_ms numeric not null,
 status_code int,
 provider_id text,
 created_at timestamptz not null default now()
);
create index if not exists performance_samples_route_idx on performance_samples(route,created_at desc);

create table if not exists recovery_tests (
 id bigserial primary key,
 scenario text not null,
 passed boolean not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
