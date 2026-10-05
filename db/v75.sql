-- Edgeforce V64: opponent and matchup learning

create table if not exists opponent_matchup_profiles (
  sport text not null,
  opponent_key text not null,
  opponent_name text not null,
  position_key text not null default '*',
  stat_key text not null,
  sample_size int not null default 0,
  mean_allowed numeric not null default 0,
  league_mean numeric not null default 0,
  relative_signal numeric not null default 0,
  volatility numeric not null default 0,
  confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(sport,opponent_key,position_key,stat_key)
);

create index if not exists opponent_matchup_profiles_lookup_idx
  on opponent_matchup_profiles(sport,opponent_key,position_key,stat_key,updated_at desc);

create table if not exists opponent_matchup_runs (
  id bigserial primary key,
  model_version text not null,
  rows_read int not null default 0,
  profiles_written int not null default 0,
  qualified_profiles int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
