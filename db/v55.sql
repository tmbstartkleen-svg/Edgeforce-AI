-- Edgeforce V106 opportunity lifecycle monitoring

create table if not exists edge_lifecycle_events (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 lifecycle_state text not null,
 action_label text not null,
 master_score numeric not null,
 prior_master_score numeric,
 edge numeric not null,
 prior_edge numeric,
 score_delta numeric,
 edge_delta numeric,
 reason text,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists edge_lifecycle_events_lookup_idx
 on edge_lifecycle_events(opportunity_id,observed_at desc);

create index if not exists edge_lifecycle_events_state_idx
 on edge_lifecycle_events(lifecycle_state,observed_at desc);
