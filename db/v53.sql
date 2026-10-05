-- Edgeforce V104 adaptive daily edge router

create table if not exists daily_edge_allocations (
 id bigserial primary key,
 generated_at timestamptz not null default now(),
 domain text not null,
 dimension text not null,
 allocation_key text not null,
 sample_size int not null,
 evidence text not null,
 rating numeric not null,
 confidence numeric not null,
 allocation_weight numeric not null,
 max_weight numeric not null,
 state text not null,
 reason text,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists daily_edge_allocations_lookup_idx
 on daily_edge_allocations(generated_at desc,domain,dimension,allocation_key);
