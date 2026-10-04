-- Edgeforce V52: persistent player intelligence and prop-performance warehouse

create table if not exists athletes (
  id text primary key,
  source_id text,
  name text not null,
  normalized_name text not null,
  sport text not null,
  team text,
  position text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (sport, normalized_name)
);

create index if not exists athletes_name_idx
  on athletes(normalized_name, sport);

create table if not exists athlete_aliases (
  athlete_id text not null references athletes(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'provider',
  created_at timestamptz not null default now(),
  primary key (athlete_id, normalized_alias)
);

create index if not exists athlete_aliases_lookup_idx
  on athlete_aliases(normalized_alias);

create table if not exists player_game_stats (
  id bigserial primary key,
  athlete_id text not null references athletes(id) on delete cascade,
  event_id text not null,
  stat_date timestamptz not null,
  opponent text,
  home_away text,
  team text,
  minutes numeric,
  usage_rate numeric,
  stats jsonb not null default '{}'::jsonb,
  source text not null,
  raw jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  unique (athlete_id, event_id, source)
);

create index if not exists player_game_stats_recent_idx
  on player_game_stats(athlete_id, stat_date desc);

create index if not exists player_game_stats_event_idx
  on player_game_stats(event_id, stat_date desc);

create table if not exists player_features (
  id bigserial primary key,
  athlete_id text not null references athletes(id) on delete cascade,
  as_of timestamptz not null default now(),
  source_window text not null,
  features jsonb not null default '{}'::jsonb,
  sample_size int not null default 0,
  source text not null default 'edgeforce-player-warehouse'
);

create index if not exists player_features_recent_idx
  on player_features(athlete_id, source_window, as_of desc);

create table if not exists player_prop_predictions (
  id bigserial primary key,
  market_id text not null,
  athlete_id text references athletes(id) on delete set null,
  player_name text not null,
  sport text not null,
  event_id text,
  event_label text,
  stat_key text,
  direction text,
  line numeric,
  venue text not null,
  offered_odds int,
  model_probability numeric,
  sim_probability numeric,
  dynamic_confidence numeric,
  closing_odds int,
  result text,
  observed_hour timestamptz not null,
  settled_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (market_id, venue, observed_hour)
);

create index if not exists player_prop_predictions_player_idx
  on player_prop_predictions(player_name, sport, observed_hour desc);

create index if not exists player_prop_predictions_performance_idx
  on player_prop_predictions(sport, stat_key, direction, result, observed_hour desc);

create index if not exists player_prop_predictions_probability_idx
  on player_prop_predictions(sim_probability desc, observed_hour desc);
