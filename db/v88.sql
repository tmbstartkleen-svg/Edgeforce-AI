-- Edgeforce V76: incident pattern learning and recurrence risk

create table if not exists incident_pattern_profiles (
  cause text primary key,
  sample_size int not null default 0,
  action_count int not null default 0,
  watch_count int not null default 0,
  recurrence_score numeric not null default 0,
  trend_score numeric not null default 0,
  cofailure_components jsonb not null default '[]'::jsonb,
  recommended_runbook jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists incident_pattern_snapshots (
  id bigserial primary key,
  model_version text not null,
  dominant_cause text not null,
  recurrence_score numeric not null default 0,
  system_risk text not null,
  profiles jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists incident_pattern_snapshots_recent_idx
  on incident_pattern_snapshots(generated_at desc);
