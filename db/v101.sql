-- Edgeforce V89: champion baseline succession and replacement readiness

create table if not exists preventive_baseline_succession_state (
  singleton_key int primary key default 1,
  status text not null default 'IDLE',
  candidate_calibration_error numeric not null default 0,
  candidate_brier_score numeric not null default 0,
  candidate_sample_size int not null default 0,
  readiness_score numeric not null default 0,
  source_windows int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_baseline_succession_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_baseline_succession_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  candidate_calibration_error numeric not null default 0,
  candidate_brier_score numeric not null default 0,
  candidate_sample_size int not null default 0,
  readiness_score numeric not null default 0,
  source_windows int not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
