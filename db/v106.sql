-- Edgeforce V94: baseline governance cycle locking and transition journal

create table if not exists preventive_baseline_governance_lock (
  singleton_key int primary key default 1,
  lock_token text,
  locked_until timestamptz,
  holder_model_version text,
  cycle_key text,
  updated_at timestamptz not null default now()
);

insert into preventive_baseline_governance_lock(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_baseline_governance_cycles (
  id bigserial primary key,
  cycle_key text not null unique,
  model_version text not null,
  status text not null,
  lock_token text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  step_results jsonb not null default '{}'::jsonb,
  error_text text
);

create index if not exists preventive_baseline_governance_cycles_recent_idx
  on preventive_baseline_governance_cycles(started_at desc);
