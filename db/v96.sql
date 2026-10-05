-- Edgeforce V84: safe threshold recovery and adaptive re-entry

create table if not exists preventive_threshold_recovery_state (
  singleton_key int primary key default 1,
  state text not null default 'OPEN',
  recovery_streak int not null default 0,
  rollback_reference_id bigint,
  adaptive_reentry_allowed boolean not null default true,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_threshold_recovery_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_threshold_recovery_snapshots (
  id bigserial primary key,
  model_version text not null,
  state text not null,
  recovery_streak int not null default 0,
  rollback_reference_id bigint,
  adaptive_reentry_allowed boolean not null,
  calibration_error numeric not null default 0,
  brier_score numeric not null default 0,
  instability_score numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists preventive_threshold_recovery_recent_idx
  on preventive_threshold_recovery_snapshots(generated_at desc);
