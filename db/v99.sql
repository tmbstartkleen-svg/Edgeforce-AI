-- Edgeforce V87: champion probation baseline governor

create table if not exists preventive_champion_baseline_state (
  singleton_key int primary key default 1,
  calibration_error numeric not null default 0,
  brier_score numeric not null default 0,
  sample_size int not null default 0,
  source text not null default 'RECOVERY_BASELINE',
  promoted_from_stage int,
  promoted_at timestamptz,
  rationale jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into preventive_champion_baseline_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_champion_baseline_snapshots (
  id bigserial primary key,
  model_version text not null,
  calibration_error numeric not null default 0,
  brier_score numeric not null default 0,
  sample_size int not null default 0,
  source text not null,
  promoted_from_stage int,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
