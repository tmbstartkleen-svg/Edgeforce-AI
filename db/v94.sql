-- Edgeforce V82: adaptive preventive-decision thresholds

create table if not exists preventive_decision_threshold_state (
  singleton_key int primary key default 1,
  recommend_threshold numeric not null default .72,
  confidence_floor numeric not null default .45,
  risk_floor numeric not null default .60,
  reject_effectiveness_ceiling numeric not null default .38,
  source_sample_size int not null default 0,
  source_brier_score numeric not null default 0,
  source_calibration_error numeric not null default 0,
  mode text not null default 'BASELINE',
  rationale jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into preventive_decision_threshold_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_decision_threshold_snapshots (
  id bigserial primary key,
  model_version text not null,
  recommend_threshold numeric not null,
  confidence_floor numeric not null,
  risk_floor numeric not null,
  reject_effectiveness_ceiling numeric not null,
  source_sample_size int not null default 0,
  source_brier_score numeric not null default 0,
  source_calibration_error numeric not null default 0,
  mode text not null,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
