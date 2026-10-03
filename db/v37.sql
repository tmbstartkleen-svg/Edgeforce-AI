-- Edgeforce V41: durable automation run health

create table if not exists automation_runs (
  id bigserial primary key,
  job_name text not null,
  status text not null,
  release_version text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  duration_ms int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_text text
);

create index if not exists automation_runs_job_recent_idx
  on automation_runs(job_name, started_at desc);

create index if not exists automation_runs_status_recent_idx
  on automation_runs(status, started_at desc);


create table if not exists production_certifications (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  commit_sha text,
  environment text not null,
  certified boolean not null,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_certifications_recent_idx
  on production_certifications(created_at desc);
