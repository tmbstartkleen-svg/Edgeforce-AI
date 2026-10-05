-- Edgeforce V113 unified opportunity command queue

create table if not exists opportunity_command_queue (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 command_id text not null,
 command_type text not null,
 severity text not null,
 domain text not null,
 category text not null,
 title text not null,
 action text not null,
 score numeric not null,
 expires_at timestamptz,
 dedupe_key text not null,
 cooldown_minutes int not null,
 reasons jsonb not null default '[]'::jsonb
);

create index if not exists opportunity_command_queue_lookup_idx
 on opportunity_command_queue(dedupe_key,observed_at desc);

create index if not exists opportunity_command_queue_severity_idx
 on opportunity_command_queue(severity,observed_at desc);
