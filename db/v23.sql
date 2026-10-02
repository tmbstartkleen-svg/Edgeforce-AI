-- Edgeforce V23: context-source audit support

create index if not exists model_runs_context_sources_idx
  on model_runs using gin ((feature_snapshot->'contextSources'));

create index if not exists model_runs_sport_features_idx
  on model_runs using gin ((feature_snapshot->'sportFeatures'));
