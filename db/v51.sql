-- Edgeforce universal markets + resolution truth engine

create table if not exists universal_event_resolutions (
  event_key text primary key,
  domain text not null check (domain in ('SPORTS','MARKETS')),
  category text not null,
  status text not null check (status in ('OPEN','PROVISIONAL','RESOLVED','DISPUTED','VOID')),
  outcome boolean,
  resolution_source text not null,
  resolution_rule text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists universal_event_resolutions_domain_idx
 on universal_event_resolutions(domain,category,status,updated_at desc);

create table if not exists universal_forecast_grades (
  id bigserial primary key,
  forecast_id text not null unique,
  event_key text not null references universal_event_resolutions(event_key) on delete cascade,
  domain text not null check (domain in ('SPORTS','MARKETS')),
  category text not null,
  venue text,
  model_version text not null,
  predicted_probability numeric not null,
  market_probability numeric,
  outcome boolean not null,
  brier numeric not null,
  log_loss numeric not null,
  calibration_error numeric not null,
  market_skill numeric,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists universal_forecast_grades_skill_idx
 on universal_forecast_grades(domain,category,model_version,settled_at desc);

create index if not exists universal_forecast_grades_venue_idx
 on universal_forecast_grades(venue,settled_at desc);
