create index if not exists market_latest_idx on market_snapshots(event_id,market_key,selection_key,pulled_at desc);
create index if not exists player_stats_recent_idx on player_game_stats(athlete_id,stat_date desc);
create index if not exists result_lookup_idx on bet_results(event_id,market_key,selection_key,settled_at desc);

create table if not exists closing_lines (
 id bigserial primary key,
 event_id text not null,
 market_key text not null,
 selection_key text not null,
 american_odds int not null,
 captured_at timestamptz default now(),
 unique(event_id,market_key,selection_key)
);

create table if not exists ranking_snapshots (
 id bigserial primary key,
 scope text not null check(scope in ('today','week')),
 model_version text not null,
 generated_at timestamptz default now(),
 rows jsonb not null
);
create index if not exists ranking_snapshots_recent_idx on ranking_snapshots(scope,generated_at desc);

create table if not exists settlement_jobs (
 id bigserial primary key,
 provider text,
 started_at timestamptz default now(),
 completed_at timestamptz,
 status text default 'running',
 events_seen int default 0,
 results_written int default 0,
 error_text text
);
