-- Edgeforce V65: lineup, role and usage redistribution learning

create table if not exists lineup_redistribution_profiles (
  athlete_id text not null references athletes(id) on delete cascade,
  absent_athlete_id text not null references athletes(id) on delete cascade,
  sport text not null,
  team_key text not null,
  stat_key text not null,
  with_games int not null default 0,
  without_games int not null default 0,
  baseline_mean numeric not null default 0,
  absent_mean numeric not null default 0,
  stat_lift numeric not null default 0,
  minutes_lift numeric not null default 0,
  usage_lift numeric not null default 0,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(athlete_id,absent_athlete_id,sport,stat_key)
);

create index if not exists lineup_redistribution_lookup_idx
  on lineup_redistribution_profiles(athlete_id,sport,team_key,stat_key,updated_at desc);

create table if not exists lineup_redistribution_runs (
  id bigserial primary key,
  model_version text not null,
  rows_read int not null default 0,
  profiles_written int not null default 0,
  qualified_profiles int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
