-- Edgeforce V95: governance watchdog, heartbeat and stale-cycle recovery

alter table preventive_baseline_governance_cycles
  add column if not exists heartbeat_at timestamptz;

create table if not exists preventive_baseline_governance_watchdog_state (
  singleton_key int primary key default 1,
  status text not null default 'HEALTHY',
  stale_cycles_found int not null default 0,
  stale_cycles_recovered int not null default 0,
  expired_locks_cleared int not null default 0,
  lease_loss_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_baseline_governance_watchdog_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_baseline_governance_watchdog_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  stale_cycles_found int not null default 0,
  stale_cycles_recovered int not null default 0,
  expired_locks_cleared int not null default 0,
  lease_loss_count int not null default 0,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
