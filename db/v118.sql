-- Edgeforce V143: certified release backlog history

create table if not exists edgeforce_release_backlog_snapshots (
  id bigserial primary key,
  live_sha text,
  head_sha text,
  newest_certified_sha text,
  backlog_depth int not null,
  certified_backlog_depth int not null,
  backlog_age_minutes int not null,
  head_certified boolean not null default false,
  catch_up_eligible boolean not null default false,
  truncated boolean not null default false,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists edgeforce_release_backlog_snapshots_created_idx
  on edgeforce_release_backlog_snapshots(created_at desc);
