-- Edgeforce V111 execution feedback and CLV-aware routing

create table if not exists execution_feedback_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 domain text not null,
 dimension text not null,
 feedback_key text not null,
 samples int not null,
 positive_rate numeric not null,
 average_capture_points numeric not null,
 median_capture_points numeric not null,
 confidence numeric not null,
 multiplier numeric not null,
 state text not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists execution_feedback_snapshots_lookup_idx
 on execution_feedback_snapshots(domain,dimension,feedback_key,observed_at desc);
