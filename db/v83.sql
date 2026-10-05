-- Edgeforce V71: unified intelligence certification and production hardening

create table if not exists intelligence_stack_certifications (
  id bigserial primary key,
  release_version text not null,
  model_version text not null,
  migration_version int not null,
  environment text not null,
  state text not null check(state in ('HEALTHY','DEGRADED','BLOCKED')),
  score numeric not null default 0,
  critical_coverage numeric not null default 0,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  components jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists intelligence_stack_certifications_recent_idx
  on intelligence_stack_certifications(observed_at desc);

create index if not exists intelligence_stack_certifications_state_idx
  on intelligence_stack_certifications(state,observed_at desc);
