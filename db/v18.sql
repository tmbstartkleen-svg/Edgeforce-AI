create table if not exists uptime_checks (
 id bigserial primary key,
 deployment_url text,
 route text not null,
 status_code int,
 duration_ms numeric,
 passed boolean not null,
 checked_at timestamptz not null default now()
);
create index if not exists uptime_checks_recent_idx on uptime_checks(checked_at desc,route);

create table if not exists deployment_observations (
 id bigserial primary key,
 deployment_id text,
 deployment_url text,
 environment text,
 status text,
 commit_sha text,
 error_count int default 0,
 metadata jsonb not null default '{}'::jsonb,
 observed_at timestamptz not null default now()
);
create index if not exists deployment_observations_recent_idx on deployment_observations(observed_at desc);
