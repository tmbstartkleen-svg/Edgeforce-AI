-- Edgeforce V78: preventive action effectiveness learning

create table if not exists preventive_action_events (
  id bigserial primary key,
  cause text not null,
  action_key text not null,
  action_text text not null,
  source_risk_score numeric not null default 0,
  source_risk_level text not null default 'LOW',
  applied_by text,
  applied_at timestamptz not null default now(),
  evaluated_at timestamptz,
  incident_occurred boolean,
  outcome text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists preventive_action_events_eval_idx
  on preventive_action_events(evaluated_at,applied_at);

create index if not exists preventive_action_events_cause_idx
  on preventive_action_events(cause,applied_at desc);

create table if not exists preventive_action_effectiveness (
  cause text not null,
  action_key text not null,
  sample_size int not null default 0,
  prevented_count int not null default 0,
  incident_count int not null default 0,
  effectiveness_score numeric not null default 0,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key(cause,action_key)
);

create table if not exists preventive_action_learning_snapshots (
  id bigserial primary key,
  model_version text not null,
  evaluated_events int not null default 0,
  best_cause text,
  best_action_key text,
  best_effectiveness numeric not null default 0,
  profiles jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
