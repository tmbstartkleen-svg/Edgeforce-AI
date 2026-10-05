-- Edgeforce V75: incident attribution and remediation evidence

create table if not exists incident_attribution_snapshots (
  id bigserial primary key,
  model_version text not null,
  overall_state text not null,
  primary_cause text not null,
  confidence numeric not null default 0,
  severity text not null,
  impacted_components jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  remediation jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists incident_attribution_snapshots_recent_idx
  on incident_attribution_snapshots(observed_at desc);
