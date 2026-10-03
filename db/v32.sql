-- Edgeforce V34: distribution-aware simulation audit indexes

create index if not exists model_runs_distribution_family_idx
  on model_runs ((feature_snapshot->>'distributionFamily'));

create index if not exists model_runs_distribution_quantiles_idx
  on model_runs using gin ((feature_snapshot->'distributionQuantiles'));
