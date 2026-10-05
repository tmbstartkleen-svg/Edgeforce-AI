-- Edgeforce V83: threshold stability and rollback governor

create table if not exists preventive_threshold_stability_state (
  singleton_key int primary key default 1,
  status text not null default 'STABLE',
  active_snapshot_id bigint,
  last_safe_snapshot_id bigint,
  rollback_count int not null default 0,
  drift_score numeric not null default 0,
  instability_score numeric not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into preventive_threshold_stability_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_threshold_stability_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  active_snapshot_id bigint,
  last_safe_snapshot_id bigint,
  drift_score numeric not null default 0,
  instability_score numeric not null default 0,
  rollback_applied boolean not null default false,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists preventive_threshold_stability_recent_idx
  on preventive_threshold_stability_snapshots(generated_at desc);
