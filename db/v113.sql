-- Edgeforce V103: cross-platform production convergence

create table if not exists release_platform_convergence (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  commit_sha text not null,
  vercel_url text,
  cloudflare_url text,
  vercel_verified boolean not null default false,
  cloudflare_verified boolean not null default false,
  commit_converged boolean not null default false,
  runtime_converged boolean not null default false,
  certified boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists release_platform_convergence_release_commit_idx
  on release_platform_convergence(release_version,commit_sha);

create index if not exists release_platform_convergence_updated_idx
  on release_platform_convergence(updated_at desc);
