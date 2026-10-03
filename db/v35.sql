-- Edgeforce V36: sport micro-simulation audit indexes

create index if not exists model_runs_sim_engine_idx
  on model_runs ((feature_snapshot->>'simEngine'));

create index if not exists model_runs_micro_unit_idx
  on model_runs ((feature_snapshot->'simProjection'->>'microUnit'));

create index if not exists model_runs_micro_unit_count_idx
  on model_runs (((feature_snapshot->'simProjection'->>'microUnitCount')::numeric))
  where feature_snapshot->'simProjection'->>'microUnitCount' is not null;
