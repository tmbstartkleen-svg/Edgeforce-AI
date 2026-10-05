-- Edgeforce V108 price targets and value thresholds

create table if not exists price_target_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 fair_probability numeric not null,
 current_market_probability numeric not null,
 great_price_probability numeric not null,
 good_price_probability numeric not null,
 acceptable_price_probability numeric not null,
 no_edge_probability numeric not null,
 current_value_state text not null,
 current_edge_points numeric not null,
 target_edge_points numeric not null,
 value_score numeric not null,
 threshold_confidence numeric not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists price_target_snapshots_lookup_idx
 on price_target_snapshots(opportunity_id,observed_at desc);

create index if not exists price_target_snapshots_state_idx
 on price_target_snapshots(current_value_state,observed_at desc);
