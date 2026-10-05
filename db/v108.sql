-- Edgeforce V96: unified supervision cycle context and evidence snapshots

create table if not exists preventive_supervision_cycle_state (
  singleton_key int primary key default 1,
  cycle_key text,
  status text not null default 'IDLE',
  reused_context_count int not null default 0,
  step_count int not null default 0,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_supervision_cycle_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_supervision_cycle_snapshots (
  id bigserial primary key,
  cycle_key text not null unique,
  model_version text not null,
  status text not null,
  reused_context_count int not null default 0,
  step_count int not null default 0,
  evidence_digest jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists preventive_supervision_cycle_snapshots_recent_idx
  on preventive_supervision_cycle_snapshots(started_at desc);
