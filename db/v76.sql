-- Edgeforce V64.1: intraday injury tracking

create table if not exists injury_context_snapshots (
  id bigserial primary key,
  provider_id text,
  quality_score numeric,
  payload jsonb not null default '{}'::jsonb,
  row_count int not null default 0,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists injury_context_snapshots_fresh_idx
  on injury_context_snapshots(observed_at desc,expires_at desc);
