-- Edgeforce V112 composite final decision gate

create table if not exists final_decision_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 decision_state text not null,
 actionability_score numeric not null,
 model_score numeric not null,
 timing_score numeric not null,
 price_score numeric not null,
 venue_score numeric not null,
 execution_feedback numeric not null,
 confidence numeric not null,
 reasons jsonb not null default '[]'::jsonb
);

create index if not exists final_decision_snapshots_lookup_idx
 on final_decision_snapshots(opportunity_id,observed_at desc);

create index if not exists final_decision_snapshots_state_idx
 on final_decision_snapshots(decision_state,observed_at desc);
