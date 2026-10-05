-- Edgeforce V105 master opportunity fusion

create table if not exists master_edge_snapshots (
 id bigserial primary key,
 generated_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 title text not null,
 model_probability numeric not null,
 market_probability numeric not null,
 edge numeric not null,
 confidence numeric not null,
 router_weight numeric not null,
 liquidity_score numeric not null,
 freshness_score numeric not null,
 master_score numeric not null,
 tier text not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists master_edge_snapshots_rank_idx
 on master_edge_snapshots(generated_at desc,master_score desc);

create index if not exists master_edge_snapshots_domain_idx
 on master_edge_snapshots(domain,category,generated_at desc);
