-- Edgeforce V30: production release and rollback audit trail

create table if not exists production_releases (
  id bigserial primary key,
  release_version text not null,
  git_sha text,
  deployment_url text,
  environment text not null default 'production',
  status text not null,
  promoted_at timestamptz,
  rollback_from_release_id bigint references production_releases(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_releases_recent_idx
  on production_releases(environment,created_at desc);

create index if not exists production_releases_status_idx
  on production_releases(status,created_at desc);
