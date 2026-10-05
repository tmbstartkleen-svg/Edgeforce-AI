-- Edgeforce V97: release execution certification

create table if not exists release_execution_certifications (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  commit_sha text not null,
  source text not null,
  lint_passed boolean not null default false,
  typecheck_passed boolean not null default false,
  build_passed boolean not null default false,
  migration_passed boolean not null default false,
  audit_passed boolean not null default false,
  smoke_passed boolean not null default false,
  load_passed boolean not null default false,
  ml_compile_passed boolean not null default false,
  remote_smoke_passed boolean not null default false,
  certified boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_execution_certifications_release_idx
  on release_execution_certifications(release_version,created_at desc);

create index if not exists release_execution_certifications_commit_idx
  on release_execution_certifications(commit_sha,created_at desc);
