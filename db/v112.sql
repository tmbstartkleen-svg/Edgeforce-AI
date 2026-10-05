-- Edgeforce V101: rollback evidence reconciliation

create table if not exists release_rollback_reconciliations (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  failed_commit_sha text not null,
  failed_deployment_url text not null,
  restored_deployment_id text,
  restored_deployment_url text,
  platform text not null,
  source text not null,
  workflow_run_id text,
  workflow_run_attempt text,
  launch_id text,
  promotion_reconciled boolean not null default false,
  verification_invalidated boolean not null default false,
  rollback_confirmed boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_rollback_reconciliations_release_idx
  on release_rollback_reconciliations(release_version,created_at desc);

create index if not exists release_rollback_reconciliations_commit_idx
  on release_rollback_reconciliations(failed_commit_sha,created_at desc);
