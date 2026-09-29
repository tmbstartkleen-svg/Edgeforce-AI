create table if not exists model_calibration_profiles (
 id bigserial primary key,
 model_name text not null,
 sport text not null,
 market_key text not null,
 sample_size int not null,
 calibration_error numeric not null,
 overconfident_samples int not null default 0,
 underconfident_samples int not null default 0,
 buckets jsonb not null default '[]'::jsonb,
 as_of timestamptz not null default now()
);
create index if not exists model_calibration_profiles_lookup_idx on model_calibration_profiles(sport,market_key,model_name,as_of desc);

create table if not exists rolling_model_rankings (
 id bigserial primary key,
 model_name text not null,
 sport text not null,
 market_key text not null,
 sample_size int not null,
 decayed_score numeric not null,
 confidence_label text not null,
 brier_score numeric,
 log_loss numeric,
 roi numeric,
 avg_clv numeric,
 calibration_error numeric,
 as_of timestamptz not null default now()
);
create index if not exists rolling_model_rankings_lookup_idx on rolling_model_rankings(sport,market_key,as_of desc);
