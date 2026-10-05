-- Edgeforce V77: predictive incident risk and preventive warnings

create table if not exists predictive_incident_risk_snapshots (
  id bigserial primary key,
  model_version text not null,
  predicted_cause text not null,
  risk_score numeric not null default 0,
  risk_level text not null,
  horizon_hours int not null default 24,
  component_risks jsonb not null default '[]'::jsonb,
  preventive_actions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists predictive_incident_risk_recent_idx
  on predictive_incident_risk_snapshots(generated_at desc);
