-- Edgeforce V81: preventive decision outcome calibration

create table if not exists preventive_decision_outcomes (
  id bigserial primary key,
  decision_snapshot_id bigint not null,
  predicted_cause text not null,
  decision text not null,
  gate_score numeric not null default 0,
  action_key text,
  evaluated_at timestamptz,
  matching_action_incident boolean,
  calibrated_success boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(decision_snapshot_id)
);

create table if not exists preventive_decision_calibration_snapshots (
  id bigserial primary key,
  model_version text not null,
  sample_size int not null default 0,
  brier_score numeric not null default 0,
  calibration_error numeric not null default 0,
  recommend_success_rate numeric not null default 0,
  hold_success_rate numeric not null default 0,
  reject_success_rate numeric not null default 0,
  profiles jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists preventive_decision_outcomes_eval_idx
  on preventive_decision_outcomes(evaluated_at,created_at);
