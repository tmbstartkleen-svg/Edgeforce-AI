-- Edgeforce V80: preventive action decision gate

create table if not exists preventive_action_decision_snapshots (
  id bigserial primary key,
  model_version text not null,
  predicted_cause text not null,
  source_risk_score numeric not null default 0,
  source_risk_level text not null default 'LOW',
  decision text not null,
  action_key text,
  action_text text,
  gate_score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists preventive_action_decision_recent_idx
  on preventive_action_decision_snapshots(generated_at desc);
