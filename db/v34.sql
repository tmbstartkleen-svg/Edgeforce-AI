-- Edgeforce V35: event-level joint simulation and learned SGP correlation

create table if not exists sgp_correlation_profiles (
  sport text not null,
  market_a text not null,
  market_b text not null,
  sample_size int not null default 0,
  joint_hits int not null default 0,
  a_hits int not null default 0,
  b_hits int not null default 0,
  phi numeric not null default 0,
  lift numeric not null default 0,
  learned_rho numeric not null default 0,
  confidence numeric not null default 0,
  minimum_sample int not null default 20,
  model_version text,
  updated_at timestamptz not null default now(),
  primary key(sport,market_a,market_b)
);

create table if not exists sgp_correlation_runs (
  id bigserial primary key,
  model_version text not null,
  pair_rows int not null default 0,
  profiles_written int not null default 0,
  active_profiles int not null default 0,
  minimum_sample int not null default 20,
  shrinkage_samples int not null default 50,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sgp_correlation_profiles_active_idx
  on sgp_correlation_profiles(sample_size desc,confidence desc,updated_at desc);

create index if not exists bet_legs_same_event_pair_idx
  on bet_legs(bet_slip_id,event_id,ordinal,result)
  where event_id is not null;
