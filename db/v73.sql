-- Edgeforce V62: player feature-frame and roster continuity warehouse

create table if not exists player_roster_snapshots (
  id bigserial primary key,
  athlete_id text not null references athletes(id) on delete cascade,
  sport text not null,
  team text,
  position text,
  roster_status text not null default 'ACTIVE',
  source text not null default 'player-warehouse',
  observed_hour timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists player_roster_snapshots_hour_uidx
  on player_roster_snapshots(athlete_id,source,observed_hour);

create index if not exists player_roster_snapshots_lookup_idx
  on player_roster_snapshots(athlete_id,observed_hour desc);

create table if not exists player_feature_frames (
  id bigserial primary key,
  market_id text not null,
  athlete_id text references athletes(id) on delete set null,
  player_name text not null,
  sport text not null,
  event_id text,
  stat_key text,
  sample_size int not null default 0,
  features jsonb not null default '{}'::jsonb,
  current_context jsonb not null default '{}'::jsonb,
  model_version text not null,
  observed_hour timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists player_feature_frames_market_hour_uidx
  on player_feature_frames(market_id,player_name,observed_hour);

create index if not exists player_feature_frames_player_idx
  on player_feature_frames(player_name,sport,observed_hour desc);

create table if not exists player_learning_state (
  athlete_id text not null references athletes(id) on delete cascade,
  sport text not null,
  stat_key text not null,
  sample_size int not null default 0,
  form_signal numeric not null default 0,
  volatility numeric not null default 0,
  home_away_signal numeric not null default 0,
  opponent_signal numeric not null default 0,
  usage_signal numeric not null default 0,
  roster_continuity numeric not null default 0,
  last_observed_at timestamptz not null default now(),
  features jsonb not null default '{}'::jsonb,
  primary key(athlete_id,sport,stat_key)
);
