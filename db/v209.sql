-- V209: source-identified score history and licensed play-by-play.
-- An observed FINAL score is one source's claim, not independently certified truth.
create table if not exists public.edgeforce_sports_outcomes_v209 (
 id bigserial primary key,
 source text not null,
 source_event_key text not null,
 sport text not null,
 league text not null,
 home_name text not null,
 away_name text not null,
 scheduled_at timestamptz not null,
 home_score integer not null check(home_score between 0 and 10000),
 away_score integer not null check(away_score between 0 and 10000),
 status text not null default 'FINAL' check(status='FINAL'),
 source_observed_at timestamptz,
 collected_at timestamptz not null default now(),
 verification text not null default 'SINGLE_SOURCE' check(verification='SINGLE_SOURCE'),
 unique(source,source_event_key,home_score,away_score)
);
create index if not exists edgeforce_sports_outcomes_v209_coverage
 on public.edgeforce_sports_outcomes_v209(sport,scheduled_at desc,source);
create index if not exists edgeforce_sports_outcomes_v209_identity
 on public.edgeforce_sports_outcomes_v209(source,source_event_key,id desc);

create table if not exists public.edgeforce_sports_plays_v209 (
 id bigserial primary key,
 source text not null,
 source_event_key text not null,
 source_play_key text not null,
 sport text not null,
 observed_at timestamptz,
 event_time timestamptz not null,
 period_label text,
 clock_label text,
 description text not null,
 player_name text,
 team_name text,
 raw_stats jsonb not null default '{}'::jsonb,
 collected_at timestamptz not null default now(),
 verification text not null default 'DECLARED_SOURCE' check(verification='DECLARED_SOURCE'),
 unique(source,source_event_key,source_play_key)
);
create index if not exists edgeforce_sports_plays_v209_coverage
 on public.edgeforce_sports_plays_v209(sport,event_time desc,source);
create index if not exists edgeforce_sports_plays_v209_event
 on public.edgeforce_sports_plays_v209(source,source_event_key,event_time,id);

create table if not exists public.edgeforce_sports_outcome_sync_v209(
 source text not null,
 feed_id text not null,
 next_allowed_at timestamptz not null default 'epoch',
 attempted_batches bigint not null default 0,
 observed_final_games bigint not null default 0,
 inserted_revisions bigint not null default 0,
 last_attempt_at timestamptz,
 primary key(source,feed_id)
);
