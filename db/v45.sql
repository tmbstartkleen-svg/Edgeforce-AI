-- Edgeforce V56: ML service health, activation and circuit-breaker audit

create table if not exists ml_service_health_snapshots (
  id bigserial primary key,
  ok boolean not null default false,
  configured boolean not null default false,
  service_version text,
  latency_ms int,
  algorithms jsonb not null default '{}'::jsonb,
  prediction_ready boolean not null default false,
  training_ready boolean not null default false,
  failure_count int not null default 0,
  circuit_open_until timestamptz,
  error_text text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists ml_service_health_recent_idx
  on ml_service_health_snapshots(checked_at desc);

create table if not exists ml_service_activation_runs (
  id bigserial primary key,
  model_version text not null,
  status text not null default 'running',
  service_version text,
  health_ok boolean not null default false,
  prediction_handshake_ok boolean not null default false,
  tournament_ok boolean not null default false,
  tournament_run_id bigint,
  candidates_evaluated int not null default 0,
  champions_promoted int not null default 0,
  champions_active int not null default 0,
  algorithms_available jsonb not null default '{}'::jsonb,
  checks jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ml_service_activation_recent_idx
  on ml_service_activation_runs(started_at desc);
