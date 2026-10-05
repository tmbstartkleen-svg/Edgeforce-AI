-- Edgeforce V123 final v1 release readiness

create table if not exists v1_release_readiness_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 architecture_release text not null,
 environment text not null,
 strict_mode boolean not null default false,
 verdict text not null,
 readiness_score numeric not null,
 blockers jsonb not null default '[]'::jsonb,
 advisories jsonb not null default '[]'::jsonb,
 gates jsonb not null default '[]'::jsonb,
 evidence jsonb not null default '{}'::jsonb
);

create index if not exists v1_release_readiness_snapshots_time_idx
 on v1_release_readiness_snapshots(observed_at desc);

create index if not exists v1_release_readiness_snapshots_verdict_idx
 on v1_release_readiness_snapshots(verdict,observed_at desc);
