-- Edgeforce V57: ML deployment automation attestations

create table if not exists ml_service_deployment_attestations (
  id bigserial primary key,
  model_version text not null,
  service_version text,
  provider text not null default 'render',
  service_id text,
  service_name text,
  service_url text,
  git_commit text,
  git_branch text,
  deployment_id text,
  deployment_status text not null,
  health_ok boolean not null default false,
  prediction_handshake_ok boolean not null default false,
  activation_state text,
  tournament_status text,
  champions_active int not null default 0,
  algorithms jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists ml_service_deployment_attestations_recent_idx
  on ml_service_deployment_attestations(created_at desc);

create index if not exists ml_service_deployment_attestations_commit_idx
  on ml_service_deployment_attestations(git_commit,created_at desc);
