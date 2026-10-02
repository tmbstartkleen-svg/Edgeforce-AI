-- Edgeforce V28: production feed integrity and fail-closed audit trail

create table if not exists feed_integrity_snapshots (
  id bigserial primary key,
  status text not null,
  official_eligible boolean not null default false,
  source text not null,
  mode text not null,
  total_markets int not null default 0,
  accepted_markets int not null default 0,
  rejected_markets int not null default 0,
  rejected_stale int not null default 0,
  rejected_invalid int not null default 0,
  rejected_conflicts int not null default 0,
  max_source_age_min numeric,
  conflict_rate numeric,
  validation_compared int not null default 0,
  validation_conflicts int not null default 0,
  reconciliation_coverage numeric,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists feed_integrity_recent_idx on feed_integrity_snapshots(created_at desc,status);
create index if not exists feed_integrity_eligibility_idx on feed_integrity_snapshots(official_eligible,created_at desc);

alter table market_snapshots add column if not exists integrity_status text;
alter table market_snapshots add column if not exists integrity_checked_at timestamptz;
