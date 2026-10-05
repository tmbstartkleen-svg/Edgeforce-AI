-- Edgeforce V79: preventive action prioritization and recommendation ranking

create table if not exists preventive_action_ranking_snapshots (
  id bigserial primary key,
  model_version text not null,
  predicted_cause text not null,
  source_risk_score numeric not null default 0,
  source_risk_level text not null default 'LOW',
  top_action_key text,
  top_action_text text,
  top_priority_score numeric not null default 0,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists preventive_action_ranking_recent_idx
  on preventive_action_ranking_snapshots(generated_at desc);
