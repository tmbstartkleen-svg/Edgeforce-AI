-- Edgeforce V85: adaptive re-entry probation and staged rollout

create table if not exists preventive_threshold_probation_state (
  singleton_key int primary key default 1,
  state text not null default 'INACTIVE',
  stage int not null default 0,
  stage_streak int not null default 0,
  adaptive_weight numeric not null default 1,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_threshold_probation_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_threshold_probation_snapshots (
  id bigserial primary key,
  model_version text not null,
  state text not null,
  stage int not null,
  stage_streak int not null,
  adaptive_weight numeric not null,
  calibration_error numeric not null default 0,
  brier_score numeric not null default 0,
  instability_score numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
