-- Edgeforce V72: production reliability, circuit breakers and auto-recovery

create table if not exists intelligence_reliability_state (
  component_id text primary key,
  label text not null,
  required boolean not null default false,
  circuit_state text not null check(circuit_state in ('CLOSED','HALF_OPEN','OPEN')),
  observed_state text not null,
  consecutive_failures int not null default 0,
  consecutive_healthy int not null default 0,
  reliability_score numeric not null default 1,
  last_reason text,
  opened_at timestamptz,
  recovered_at timestamptz,
  last_transition_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists intelligence_reliability_state_circuit_idx
  on intelligence_reliability_state(circuit_state,required,updated_at desc);

create table if not exists intelligence_reliability_events (
  id bigserial primary key,
  component_id text not null,
  previous_state text not null,
  next_state text not null,
  observed_state text not null,
  required boolean not null default false,
  reliability_score numeric not null default 0,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_reliability_events_component_idx
  on intelligence_reliability_events(component_id,created_at desc);

create table if not exists intelligence_reliability_runs (
  id bigserial primary key,
  model_version text not null,
  system_mode text not null check(system_mode in ('NORMAL','DEGRADED','PROTECTIVE')),
  components_checked int not null default 0,
  open_components int not null default 0,
  half_open_components int not null default 0,
  opened_this_run int not null default 0,
  recovered_this_run int not null default 0,
  reliability_score numeric not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
