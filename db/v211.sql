-- V211: durable bounded agent-team scheduling, no destructive resets on migration.
create table if not exists public.edgeforce_network_agents_v211 (
 agent_id text primary key,
 category text not null,
 enabled boolean not null default true,
 cadence_minutes integer not null check(cadence_minutes between 30 and 1440),
 next_due_at timestamptz not null default 'epoch',
 lease_token text,
 lease_until timestamptz not null default 'epoch',
 last_started_at timestamptz,
 last_finished_at timestamptz,
 last_result text not null default 'NEVER_RUN',
 completed_runs bigint not null default 0,
 consecutive_failures integer not null default 0,
 last_error text
);
create index if not exists edgeforce_network_agents_v211_due_idx
 on public.edgeforce_network_agents_v211(enabled,next_due_at,lease_until);
create table if not exists public.edgeforce_network_agent_observations_v211 (
 id bigserial primary key,
 agent_id text not null references public.edgeforce_network_agents_v211(agent_id),
 observed_at timestamptz not null default now(),
 source_role text not null check(source_role in ('STORED_FEED_DERIVED','AUTHORIZED_EXTERNAL_SCORE')),
 source_ids text[] not null default '{}'::text[],
 result_status text not null check(result_status in ('EVIDENCE_FOUND','NO_RECENT_EVIDENCE','NO_LICENSE','ERROR')),
 event_count integer not null default 0 check(event_count between 0 and 500),
 payload jsonb not null default '{}'::jsonb,
 run_id text not null unique
);
create index if not exists edgeforce_network_agent_observations_v211_recent_idx
 on public.edgeforce_network_agent_observations_v211(agent_id,observed_at desc);
insert into public.edgeforce_network_agents_v211(agent_id,category,cadence_minutes)
values
 ('market-watch','ODDS',60),
 ('score-watch','SCORES',60),
 ('injury-watch','INJURIES',60),
 ('player-watch','PLAYERS',90),
 ('forecast-audit','MODELS',90),
 ('book-comparison','MARKET_COMPARISON',90)
on conflict (agent_id) do nothing;
