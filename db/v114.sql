-- Edgeforce V104: final production closure certificate

create table if not exists release_final_closures (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  commit_sha text not null,
  execution_certified boolean not null default false,
  promotion_verified boolean not null default false,
  post_promotion_verified boolean not null default false,
  platform_converged boolean not null default false,
  rollback_clear boolean not null default false,
  closed boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  source text,
  workflow_run_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists release_final_closures_release_commit_idx
  on release_final_closures(release_version,commit_sha);

create index if not exists release_final_closures_created_idx
  on release_final_closures(created_at desc);
