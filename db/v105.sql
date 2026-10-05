-- Edgeforce V93: baseline lifecycle consistency and reconciliation

create table if not exists preventive_baseline_consistency_state (
  singleton_key int primary key default 1,
  status text not null default 'HEALTHY',
  issue_count int not null default 0,
  repaired_count int not null default 0,
  consistency_score numeric not null default 1,
  last_repair_codes jsonb not null default '[]'::jsonb,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_baseline_consistency_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_baseline_consistency_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  issue_count int not null default 0,
  repaired_count int not null default 0,
  consistency_score numeric not null default 1,
  issues jsonb not null default '[]'::jsonb,
  repair_codes jsonb not null default '[]'::jsonb,
  lifecycle jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
