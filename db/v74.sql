-- Edgeforce V63: player-level probability calibration

create table if not exists player_calibration_profiles (
  athlete_id text not null references athletes(id) on delete cascade,
  sport text not null,
  stat_key text not null,
  direction text not null,
  sample_size int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  pushes int not null default 0,
  average_model_probability numeric not null default 0,
  observed_hit_rate numeric not null default 0,
  calibration_bias numeric not null default 0,
  confidence numeric not null default 0,
  brier_score numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(athlete_id,sport,stat_key,direction)
);

create index if not exists player_calibration_profiles_sport_idx
  on player_calibration_profiles(sport,stat_key,direction,updated_at desc);

create table if not exists player_calibration_runs (
  id bigserial primary key,
  model_version text not null,
  rows_read int not null default 0,
  profiles_written int not null default 0,
  qualified_profiles int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
