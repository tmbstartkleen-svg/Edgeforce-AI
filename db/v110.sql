-- Edgeforce V99: production promotion provenance ledger

create table if not exists release_promotion_provenance (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  commit_sha text not null,
  platform text not null,
  deployment_url text not null,
  deployment_id text,
  source text not null,
  workflow_run_id text,
  workflow_run_attempt text,
  execution_certified boolean not null default false,
  strict_certified boolean not null default false,
  canary_passed boolean not null default false,
  v1_ready boolean not null default false,
  promoted boolean not null default false,
  rolled_back boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_promotion_provenance_release_idx
  on release_promotion_provenance(release_version,created_at desc);

create index if not exists release_promotion_provenance_commit_idx
  on release_promotion_provenance(commit_sha,created_at desc);
