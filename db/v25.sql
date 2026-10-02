-- Edgeforce V25: player context and SGP correlation audit support

create index if not exists model_runs_player_context_idx
  on model_runs using gin ((feature_snapshot->'playerContext'));

create index if not exists model_runs_player_name_idx
  on model_runs ((feature_snapshot->'playerContext'->>'name'));
