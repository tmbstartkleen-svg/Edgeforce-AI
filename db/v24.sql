-- Edgeforce V24: sport outcome simulation audit indexes

create index if not exists model_runs_sim_engine_idx
  on model_runs ((feature_snapshot->>'simEngine'));

create index if not exists model_runs_sim_projection_idx
  on model_runs using gin ((feature_snapshot->'simProjection'));
