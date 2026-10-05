-- Edgeforce V86: probation performance monitor and stage rollback

create table if not exists preventive_probation_performance_state (
  singleton_key int primary key default 1,
  status text not null default 'STABLE',
  baseline_calibration_error numeric not null default 0,
  baseline_brier_score numeric not null default 0,
  current_calibration_error numeric not null default 0,
  current_brier_score numeric not null default 0,
  degradation_score numeric not null default 0,
  stage_rollback_applied boolean not null default false,
  rollback_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_probation_performance_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_probation_performance_snapshots (
  id bigserial primary key,
  model_version text not null,
  probation_state text not null,
  probation_stage int not null default 0,
  adaptive_weight numeric not null default 0,
  status text not null,
  degradation_score numeric not null default 0,
  rollback_applied boolean not null default false,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
