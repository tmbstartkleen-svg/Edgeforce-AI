-- Edgeforce V90: validated successor promotion and champion handoff

create table if not exists preventive_baseline_handoff_state (
  singleton_key int primary key default 1,
  status text not null default 'IDLE',
  promoted boolean not null default false,
  source_readiness_score numeric not null default 0,
  promoted_calibration_error numeric not null default 0,
  promoted_brier_score numeric not null default 0,
  promoted_sample_size int not null default 0,
  promotion_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_baseline_handoff_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_baseline_handoff_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  promoted boolean not null default false,
  source_readiness_score numeric not null default 0,
  calibration_error numeric not null default 0,
  brier_score numeric not null default 0,
  sample_size int not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
