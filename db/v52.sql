-- Edgeforce V103 cross-domain skill and strategy ratings

alter table universal_forecast_grades
 add column if not exists strategy_key text not null default 'GENERAL';

create index if not exists universal_forecast_grades_strategy_idx
 on universal_forecast_grades(domain,strategy_key,settled_at desc);

create table if not exists forecast_skill_snapshots (
 id bigserial primary key,
 generated_at timestamptz not null default now(),
 domain text not null,
 dimension text not null,
 rating_key text not null,
 sample_size int not null,
 wins int not null,
 hit_rate numeric not null,
 average_prediction numeric not null,
 brier numeric not null,
 log_loss numeric not null,
 calibration_error numeric not null,
 market_skill numeric,
 confidence numeric not null,
 rating numeric not null,
 evidence text not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists forecast_skill_snapshots_lookup_idx
 on forecast_skill_snapshots(domain,dimension,rating_key,generated_at desc);
