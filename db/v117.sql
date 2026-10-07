-- Edgeforce V142: durable queue allocation and fairness telemetry

alter table vercel_governor_decisions
  add column if not exists queue_rank int,
  add column if not exists fairness_score numeric,
  add column if not exists normal_budget_share int,
  add column if not exists project_usage_24h int,
  add column if not exists budget_state text,
  add column if not exists borrowed_capacity boolean not null default false;

create index if not exists vercel_governor_decisions_queue_idx
  on vercel_governor_decisions(created_at desc,queue_rank);
