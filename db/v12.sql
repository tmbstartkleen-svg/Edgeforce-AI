create table if not exists console_preferences (
 id bigserial primary key,
 preference_key text not null unique,
 preference_value jsonb not null,
 updated_at timestamptz default now()
);

create table if not exists console_audit_events (
 id bigserial primary key,
 event_type text not null,
 actor text not null default 'system',
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz default now()
);
create index if not exists console_audit_recent_idx on console_audit_events(created_at desc);

create index if not exists model_health_recent_idx on sport_model_performance(updated_at desc,sport,market_key);
create index if not exists repricing_recent_idx on repricing_events(created_at desc,market_id);
create index if not exists position_lifecycle_idx on open_positions(status,lifecycle_state,opened_at desc);
