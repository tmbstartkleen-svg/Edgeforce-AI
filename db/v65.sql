-- Edgeforce V116 cash-out reconciliation and truth linkage

alter table cashout_observations
 add column if not exists event_key text,
 add column if not exists resolution_source text,
 add column if not exists settled_at timestamptz;

create index if not exists cashout_observations_event_idx
 on cashout_observations(event_key,outcome,created_at desc);
