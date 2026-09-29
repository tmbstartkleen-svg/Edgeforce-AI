create table if not exists decision_journal (
 id bigserial primary key,
 market_id text,
 event_id text,
 action text not null,
 reasons jsonb not null default '[]'::jsonb,
 before_state jsonb not null default '{}'::jsonb,
 after_state jsonb not null default '{}'::jsonb,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz default now()
);
create index if not exists decision_journal_recent_idx on decision_journal(created_at desc,action);

create table if not exists alerts (
 id bigserial primary key,
 alert_type text not null,
 severity text not null,
 market_id text,
 event_id text,
 message text not null,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz default now(),
 resolved_at timestamptz
);
create index if not exists alerts_open_idx on alerts(resolved_at,created_at desc);

alter table open_positions add column if not exists lifecycle_state text default 'OPEN';
alter table open_positions add column if not exists last_repriced_at timestamptz;
alter table open_positions add column if not exists current_probability numeric;
alter table open_positions add column if not exists current_expected_value numeric;

create table if not exists repricing_events (
 id bigserial primary key,
 market_id text not null,
 trigger_type text not null,
 previous_probability numeric,
 new_probability numeric,
 previous_ev numeric,
 new_ev numeric,
 payload jsonb default '{}'::jsonb,
 created_at timestamptz default now()
);
create index if not exists repricing_events_market_idx on repricing_events(market_id,created_at desc);
