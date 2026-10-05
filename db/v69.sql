-- Edgeforce V120 stress scenario lab

create table if not exists stress_scenario_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 baseline_state text not null,
 baseline_score numeric not null,
 robustness_score numeric not null,
 survival_rate numeric not null,
 worst_scenario text not null,
 worst_score numeric not null,
 worst_state text not null,
 classification text not null,
 scenario_results jsonb not null default '[]'::jsonb
);

create index if not exists stress_scenario_snapshots_lookup_idx
 on stress_scenario_snapshots(opportunity_id,observed_at desc);

create index if not exists stress_scenario_snapshots_class_idx
 on stress_scenario_snapshots(classification,observed_at desc);
