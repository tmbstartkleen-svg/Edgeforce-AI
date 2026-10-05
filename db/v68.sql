-- Edgeforce V119 end-to-end decision replay validation

create table if not exists decision_replay_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 decision_state text not null,
 samples int not null,
 graded_samples int not null,
 positive_rate numeric not null,
 average_utility numeric not null,
 average_score_delta numeric not null,
 average_edge_delta numeric not null,
 average_captured_value numeric not null,
 decay_rate numeric not null,
 confidence numeric not null,
 ordering_status text not null,
 ordering_score numeric not null
);

create index if not exists decision_replay_snapshots_state_idx
 on decision_replay_snapshots(decision_state,observed_at desc);
