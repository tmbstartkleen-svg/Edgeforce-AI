-- Edgeforce V29: production release readiness and audit support

create table if not exists release_audits (
  id bigserial primary key,
  release_version text not null,
  git_sha text,
  environment text not null,
  ready_for_preview boolean not null default false,
  ready_for_production boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_audits_recent_idx
  on release_audits(environment,created_at desc);
