-- Edgeforce V117 learned cash-out policy thresholds

create table if not exists cashout_policy_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 sportsbook text not null,
 alert_type text not null,
 samples int not null,
 settled_samples int not null,
 threshold_edge_pct numeric not null,
 raw_best_threshold_pct numeric not null,
 baseline_threshold_pct numeric not null,
 classification_accuracy numeric not null,
 confidence numeric not null,
 state text not null,
 recommendation_band jsonb not null default '{}'::jsonb
);

create index if not exists cashout_policy_snapshots_lookup_idx
 on cashout_policy_snapshots(sportsbook,alert_type,observed_at desc);
