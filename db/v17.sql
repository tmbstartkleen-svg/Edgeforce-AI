create table if not exists release_candidates (
 id bigserial primary key,
 version text not null,
 commit_sha text,
 preview_url text,
 production_url text,
 migration_version int,
 smoke_passed boolean not null default false,
 promoted boolean not null default false,
 rollback_target text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 promoted_at timestamptz
);

create index if not exists release_candidates_version_idx
 on release_candidates(version,created_at desc);

create table if not exists deployment_checks (
 id bigserial primary key,
 release_candidate_id bigint references release_candidates(id),
 check_name text not null,
 passed boolean not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
