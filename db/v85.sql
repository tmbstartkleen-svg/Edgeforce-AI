-- Edgeforce V73: comparative canary deployment guard

create table if not exists deployment_guard_runs (
  id bigserial primary key,
  launch_id text,
  candidate_version text not null,
  baseline_version text,
  decision text not null check(decision in ('PASS','BLOCK')),
  hard_block boolean not null default false,
  score_delta numeric,
  reliability_delta numeric,
  critical_check_delta int,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  baseline jsonb not null default '{}'::jsonb,
  candidate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deployment_guard_runs_launch_idx
  on deployment_guard_runs(launch_id,created_at desc);

create index if not exists deployment_guard_runs_decision_idx
  on deployment_guard_runs(decision,hard_block,created_at desc);
