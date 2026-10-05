-- Edgeforce V114 command effectiveness and alert learning

create table if not exists command_effectiveness_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 command_type text not null,
 samples int not null,
 graded_samples int not null,
 positive_samples int not null,
 positive_rate numeric not null,
 average_utility numeric not null,
 confidence numeric not null,
 multiplier numeric not null,
 evidence text not null,
 state text not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists command_effectiveness_snapshots_lookup_idx
 on command_effectiveness_snapshots(command_type,observed_at desc);
