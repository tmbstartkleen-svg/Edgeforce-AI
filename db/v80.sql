-- Edgeforce V68: venue, weather and playing-condition intelligence

create table if not exists venue_condition_snapshots (
  id bigserial primary key,
  sport text not null,
  event_id text not null,
  event_name text,
  start_time timestamptz not null,
  venue_key text not null,
  venue_name text,
  city text,
  state text,
  country text,
  indoor boolean not null default false,
  surface text,
  elevation_ft numeric,
  temperature_f numeric,
  apparent_temperature_f numeric,
  humidity_pct numeric,
  precipitation_probability numeric,
  precipitation_in numeric,
  snowfall_in numeric,
  wind_mph numeric,
  wind_gust_mph numeric,
  cloud_cover_pct numeric,
  condition_severity numeric not null default 0,
  total_effect numeric not null default 0,
  home_edge numeric not null default 0,
  pace_effect numeric not null default 0,
  volatility_effect numeric not null default 0,
  confidence numeric not null default 0,
  observed_hour timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists venue_condition_snapshots_event_hour_uidx
  on venue_condition_snapshots(sport,event_id,observed_hour);

create index if not exists venue_condition_snapshots_venue_idx
  on venue_condition_snapshots(sport,venue_key,observed_hour desc);

create table if not exists venue_condition_profiles (
  sport text not null,
  venue_key text not null,
  venue_name text,
  sample_count int not null default 0,
  indoor_rate numeric not null default 0,
  avg_temperature_f numeric,
  avg_humidity_pct numeric,
  avg_wind_mph numeric,
  avg_elevation_ft numeric,
  avg_condition_severity numeric not null default 0,
  avg_total_effect numeric not null default 0,
  avg_home_edge numeric not null default 0,
  avg_volatility_effect numeric not null default 0,
  avg_confidence numeric not null default 0,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key(sport,venue_key)
);

create table if not exists venue_condition_runs (
  id bigserial primary key,
  model_version text not null,
  snapshots_read int not null default 0,
  profiles_written int not null default 0,
  venues_profiled int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
