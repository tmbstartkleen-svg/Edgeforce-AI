-- Edgeforce V91: post-handoff successor validation and automatic reversion

create table if not exists preventive_successor_validation_state (
  singleton_key int primary key default 1,
  status text not null default 'IDLE',
  validation_streak int not null default 0,
  degradation_score numeric not null default 0,
  reverted boolean not null default false,
  reversion_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_successor_validation_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_successor_validation_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  validation_streak int not null default 0,
  degradation_score numeric not null default 0,
  reverted boolean not null default false,
  baseline_calibration_error numeric not null default 0,
  baseline_brier_score numeric not null default 0,
  current_calibration_error numeric not null default 0,
  current_brier_score numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
