alter table alerts add column if not exists acknowledged_by text;
alter table alerts add column if not exists acknowledged_at timestamptz;

create table if not exists scenario_runs (
 id bigserial primary key,
 scenario_name text,
 market_id text,
 input jsonb not null,
 output jsonb not null,
 read_only boolean not null default true,
 created_at timestamptz default now()
);

create table if not exists console_drilldown_events (
 id bigserial primary key,
 entity_type text not null,
 entity_id text not null,
 action text not null,
 metadata jsonb default '{}'::jsonb,
 created_at timestamptz default now()
);
create index if not exists console_drilldown_recent_idx on console_drilldown_events(created_at desc);
