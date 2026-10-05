-- Edgeforce V107 opportunity timing and entry windows

create table if not exists entry_window_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 timing_state text not null,
 timing_score numeric not null,
 timing_confidence numeric not null,
 hours_remaining numeric,
 score_velocity_per_hour numeric not null,
 edge_velocity_per_hour numeric not null,
 score_volatility numeric not null,
 edge_volatility numeric not null,
 history_points int not null,
 action_label text not null,
 master_score numeric not null,
 edge numeric not null,
 reason text,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists entry_window_snapshots_lookup_idx
 on entry_window_snapshots(opportunity_id,observed_at desc);

create index if not exists entry_window_snapshots_state_idx
 on entry_window_snapshots(timing_state,observed_at desc);
