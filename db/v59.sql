-- Edgeforce V110 closing-line value and price-capture benchmarks

create table if not exists price_capture_benchmarks (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 opportunity_id text not null,
 domain text not null,
 category text not null,
 venue text,
 first_best_probability numeric,
 latest_best_probability numeric,
 captured_value_points numeric,
 captured_value_pct numeric,
 observations int not null,
 grade text not null,
 benchmark_confidence numeric not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists price_capture_benchmarks_lookup_idx
 on price_capture_benchmarks(opportunity_id,observed_at desc);

create index if not exists price_capture_benchmarks_venue_idx
 on price_capture_benchmarks(domain,venue,observed_at desc);
