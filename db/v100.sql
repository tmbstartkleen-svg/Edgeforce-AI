-- Edgeforce V88: champion baseline drift and retirement governor

create table if not exists preventive_champion_baseline_health_state (
  singleton_key int primary key default 1,
  status text not null default 'ACTIVE',
  drift_score numeric not null default 0,
  age_days numeric not null default 0,
  retired boolean not null default false,
  retirement_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_champion_baseline_health_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_champion_baseline_health_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  drift_score numeric not null default 0,
  age_days numeric not null default 0,
  retired boolean not null default false,
  champion_calibration_error numeric not null default 0,
  champion_brier_score numeric not null default 0,
  current_calibration_error numeric not null default 0,
  current_brier_score numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
