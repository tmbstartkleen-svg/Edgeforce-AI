create table if not exists historical_predictions (
 id bigserial primary key,
 occurred_at timestamptz not null,
 sport text not null,
 market_key text not null,
 selection_key text,
 model_name text not null,
 model_version text not null,
 predicted_probability numeric not null,
 offered_odds int not null,
 closing_odds int,
 outcome int check(outcome in (0,1)),
 features jsonb default '{}'::jsonb,
 created_at timestamptz default now()
);
create index if not exists historical_predictions_idx on historical_predictions(sport,market_key,model_name,occurred_at);

create table if not exists backtest_runs (
 id bigserial primary key,
 model_version text not null,
 sport text,
 market_key text,
 train_start timestamptz,
 train_end timestamptz,
 test_start timestamptz,
 test_end timestamptz,
 train_size int,
 test_size int,
 metrics jsonb not null,
 created_at timestamptz default now()
);

create table if not exists rolling_feature_snapshots (
 id bigserial primary key,
 entity_type text not null,
 entity_id text not null,
 sport text not null,
 as_of timestamptz not null,
 window_size int not null,
 features jsonb not null,
 source text,
 unique(entity_type,entity_id,as_of,window_size)
);
create index if not exists rolling_features_lookup on rolling_feature_snapshots(sport,entity_type,entity_id,as_of desc);

create table if not exists learned_model_weights (
 id bigserial primary key,
 model_version text not null,
 sport text not null,
 market_key text not null,
 model_name text not null,
 weight numeric not null,
 score numeric not null,
 sample_size int not null,
 effective_from timestamptz default now(),
 effective_to timestamptz,
 unique(model_version,sport,market_key,model_name,effective_from)
);
