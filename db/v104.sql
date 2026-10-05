-- Edgeforce V92: successor graduation and lifecycle closure

create table if not exists preventive_successor_graduation_state (
  singleton_key int primary key default 1,
  status text not null default 'IDLE',
  graduated boolean not null default false,
  graduation_count int not null default 0,
  validation_streak int not null default 0,
  source text,
  last_reason text,
  updated_at timestamptz not null default now()
);

insert into preventive_successor_graduation_state(singleton_key)
values(1) on conflict(singleton_key) do nothing;

create table if not exists preventive_successor_graduation_snapshots (
  id bigserial primary key,
  model_version text not null,
  status text not null,
  graduated boolean not null default false,
  validation_streak int not null default 0,
  champion_source text,
  rationale jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
