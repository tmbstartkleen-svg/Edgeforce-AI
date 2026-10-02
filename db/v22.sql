-- Edgeforce V22: learned model weight snapshots

create table if not exists learned_model_weight_snapshots (
  id bigserial primary key,
  model_name text not null,
  sport text not null,
  market_key text not null,
  multiplier numeric not null,
  sample_size int,
  calibration_error numeric,
  decayed_score numeric,
  avg_clv numeric,
  as_of timestamptz default now()
);

create index if not exists learned_model_weight_lookup_idx
  on learned_model_weight_snapshots(model_name,sport,market_key,as_of desc);
