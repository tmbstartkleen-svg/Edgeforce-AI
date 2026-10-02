-- Edgeforce V30: production observability and release hardening

create table if not exists operational_heartbeats (
  id bigserial primary key,
  version text not null,
  environment text not null,
  ready boolean not null,
  production_ready boolean not null,
  odds_operational int not null default 0,
  required_failures jsonb not null default '[]'::jsonb,
  commit_sha text,
  created_at timestamptz not null default now()
);

create index if not exists operational_heartbeats_recent_idx
  on operational_heartbeats(created_at desc);

create table if not exists release_attestations (
  id bigserial primary key,
  version text not null,
  commit_sha text,
  environment text,
  migration_version int,
  build_passed boolean not null default false,
  smoke_passed boolean not null default false,
  load_passed boolean not null default false,
  readiness_passed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_attestations_version_idx
  on release_attestations(version,created_at desc);

create index if not exists performance_samples_recent_route_idx
  on performance_samples(created_at desc,route);
