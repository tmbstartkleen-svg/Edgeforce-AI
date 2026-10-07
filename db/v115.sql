-- Edgeforce V140: durable Vercel governor telemetry snapshots

create table if not exists vercel_governor_snapshots (
  id bigserial primary key,
  usage int not null,
  soft_cap int not null,
  hard_cap int not null,
  emergency_reserve int not null,
  normal_remaining int not null,
  reserve_consumed int not null,
  over_hard_cap int not null,
  slots_to_recover int not null,
  next_normal_slot_at timestamptz,
  project_usage jsonb not null default '{}'::jsonb,
  project_states jsonb not null default '[]'::jsonb,
  deployment_states jsonb not null default '{}'::jsonb,
  source text not null default 'vercel-api',
  created_at timestamptz not null default now()
);

create index if not exists vercel_governor_snapshots_created_idx
  on vercel_governor_snapshots(created_at desc);
