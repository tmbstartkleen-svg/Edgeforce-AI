-- Edgeforce V141: governor decision history and recovery alerts

create table if not exists vercel_governor_decisions (
  id bigserial primary key,
  snapshot_id bigint references vercel_governor_snapshots(id) on delete cascade,
  project_key text not null,
  project_name text not null,
  decision text not null,
  reason text not null,
  pending boolean not null default false,
  active int not null default 0,
  cooldown_ready boolean not null default false,
  usage int not null,
  soft_cap int not null,
  hard_cap int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists vercel_governor_decisions_snapshot_project_idx
  on vercel_governor_decisions(snapshot_id,project_key);

create index if not exists vercel_governor_decisions_created_idx
  on vercel_governor_decisions(created_at desc);

create table if not exists vercel_governor_alerts (
  id bigserial primary key,
  alert_key text not null unique,
  severity text not null,
  category text not null,
  project_key text,
  message text not null,
  active boolean not null default true,
  detail jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists vercel_governor_alerts_active_idx
  on vercel_governor_alerts(active,last_seen_at desc);
