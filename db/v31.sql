-- Edgeforce V32: line movement, steam detection and persistent CLV

alter table bet_legs add column if not exists closing_implied_probability numeric;
alter table bet_legs add column if not exists clv_probability numeric;

create index if not exists market_snapshots_line_history_idx
  on market_snapshots(event_id,market_key,selection_key,pulled_at desc);

create index if not exists bet_legs_clv_idx
  on bet_legs(clv_probability) where clv_probability is not null;


-- Provider certification and launch-doctor history
create table if not exists provider_certification_runs (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  status text not null default 'running',
  configured_count int not null default 0,
  certified_count int not null default 0,
  caution_count int not null default 0,
  failed_count int not null default 0,
  coverage_score numeric not null default 0,
  launch_ready boolean not null default false,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists provider_certifications (
  id bigserial primary key,
  run_id bigint references provider_certification_runs(id) on delete cascade,
  provider_id text not null,
  provider_name text not null,
  capability text not null,
  status text not null,
  priority int not null default 0,
  latency_ms numeric,
  http_status int,
  row_count int,
  normalized_count int,
  payload_age_minutes numeric,
  freshness_score numeric,
  quality_score numeric,
  quality_grade text,
  auth_configured boolean not null default false,
  max_age_minutes int,
  error_text text,
  reasons jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists provider_certification_runs_recent_idx
  on provider_certification_runs(started_at desc);

create index if not exists provider_certifications_provider_idx
  on provider_certifications(provider_id,checked_at desc);

create index if not exists provider_certifications_capability_idx
  on provider_certifications(capability,status,checked_at desc);
