-- Edgeforce V100: post-promotion verification certificates

create table if not exists release_post_promotion_verifications (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  deployed_commit_sha text not null,
  promotion_commit_sha text not null,
  execution_commit_sha text not null,
  deployment_url text not null,
  platform text not null,
  source text not null,
  workflow_run_id text,
  provenance_id bigint,
  execution_certified boolean not null default false,
  promotion_verified boolean not null default false,
  runtime_identity_verified boolean not null default false,
  commit_identity_verified boolean not null default false,
  certified boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_post_promotion_verifications_release_idx
  on release_post_promotion_verifications(release_version,created_at desc);

create index if not exists release_post_promotion_verifications_commit_idx
  on release_post_promotion_verifications(deployed_commit_sha,created_at desc);
