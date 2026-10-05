-- Edgeforce V124 production launch controller

create table if not exists production_launch_events (
 id bigserial primary key,
 launch_id text not null,
 stage text not null,
 deployment_url text,
 commit_sha text,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists production_launch_events_launch_idx
 on production_launch_events(launch_id,created_at asc);

create index if not exists production_launch_events_stage_idx
 on production_launch_events(stage,created_at desc);
