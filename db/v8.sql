create table if not exists sport_feature_snapshots (
 id bigserial primary key,
 event_id text not null,
 market_key text not null,
 selection_key text not null,
 sport text not null,
 features jsonb not null,
 feature_version text not null default 'v8',
 as_of timestamptz default now()
);
create index if not exists sport_feature_recent_idx on sport_feature_snapshots(sport,event_id,as_of desc);

create table if not exists sport_model_performance (
 id bigserial primary key,
 model_version text not null,
 sport text not null,
 market_key text not null,
 sample_size int default 0,
 hit_rate numeric,
 brier_score numeric,
 log_loss numeric,
 calibration_error numeric,
 roi numeric,
 avg_clv numeric,
 max_drawdown numeric,
 period_start date,
 period_end date,
 updated_at timestamptz default now(),
 unique(model_version,sport,market_key,period_start,period_end)
);

create table if not exists feature_importance_history (
 id bigserial primary key,
 model_version text not null,
 sport text not null,
 market_key text not null,
 feature_name text not null,
 importance numeric not null,
 sample_size int default 0,
 calculated_at timestamptz default now()
);
create index if not exists feature_importance_lookup_idx on feature_importance_history(sport,market_key,calculated_at desc);
