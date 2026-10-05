-- Edgeforce V74: SLO error-budget governor and deployment freeze

create table if not exists slo_error_budget_state (
  singleton_key int primary key check(singleton_key=1),
  deployment_state text not null check(deployment_state in ('OPEN','FROZEN','RECOVERING')),
  recovery_streak int not null default 0,
  slo_target numeric not null default 0.99,
  last_reason text,
  frozen_at timestamptz,
  recovered_at timestamptz,
  last_transition_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists slo_error_budget_snapshots (
  id bigserial primary key,
  model_version text not null,
  deployment_state text not null,
  slo_target numeric not null,
  deployment_allowed boolean not null,
  freeze_triggered boolean not null default false,
  recovery_eligible boolean not null default false,
  current_overall text not null,
  current_score numeric not null default 0,
  one_hour jsonb not null default '{}'::jsonb,
  twenty_four_hour jsonb not null default '{}'::jsonb,
  seven_day jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists slo_error_budget_snapshots_recent_idx
  on slo_error_budget_snapshots(observed_at desc);

create table if not exists slo_error_budget_events (
  id bigserial primary key,
  previous_state text not null,
  next_state text not null,
  reason text not null,
  recovery_streak int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists slo_error_budget_events_recent_idx
  on slo_error_budget_events(created_at desc);
