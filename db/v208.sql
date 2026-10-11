-- V208: bounded, first-party, append-only archive of already authorized EdgeForce records.
-- Source records are not league-owned or executable odds merely because archived here.
create table if not exists public.edgeforce_sports_archive_v208 (
 id bigserial primary key,
 record_type text not null check(record_type in ('MARKET_OBSERVATION','MODEL_FORECAST','PLAYER_STAT')),
 source_record_id bigint not null,
 source_provider text not null,
 source_observed_at timestamptz,
 first_archived_at timestamptz not null default now(),
 event_id text not null,
 event_time timestamptz not null,
 sport text not null,
 league text,
 subject text not null,
 data jsonb not null default '{}'::jsonb,
 unique(record_type,source_record_id)
);
create index if not exists edgeforce_sports_archive_v208_time_idx on public.edgeforce_sports_archive_v208(event_time desc,sport,record_type);
create index if not exists edgeforce_sports_archive_v208_subject_idx on public.edgeforce_sports_archive_v208(record_type,sport,source_observed_at desc);
create table if not exists public.edgeforce_sports_archive_sync_v208 (
 record_type text primary key check(record_type in ('MARKET_OBSERVATION','MODEL_FORECAST','PLAYER_STAT')),
 last_source_id bigint not null default 0,
 attempted_batches bigint not null default 0,
 copied_records bigint not null default 0,
 last_batch_at timestamptz,
 next_allowed_at timestamptz not null default 'epoch',
 last_seen_source_at timestamptz
);
insert into public.edgeforce_sports_archive_sync_v208(record_type)
values('MARKET_OBSERVATION'),('MODEL_FORECAST'),('PLAYER_STAT')
on conflict do nothing;
