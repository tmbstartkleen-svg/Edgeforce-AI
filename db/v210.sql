-- V210: explicitly reviewed, source-specific entity mappings. No fuzzy self-merges.
create table if not exists public.edgeforce_identity_links_v210 (
 id bigserial primary key,
 entity_type text not null check(entity_type in ('EVENT','TEAM','ATHLETE')),
 canonical_id text not null,
 source text not null,
 source_entity_id text not null,
 review_status text not null default 'SOURCE_OBSERVED' check(review_status in ('SOURCE_OBSERVED','NAME_AND_TIME_MATCHED')),
 matched_at timestamptz not null default now(),
 evidence jsonb not null default '{}'::jsonb,
 unique(entity_type,source,source_entity_id)
);
create index if not exists edgeforce_identity_links_v210_canonical
 on public.edgeforce_identity_links_v210(entity_type,canonical_id,source);

-- Upstream ownership must be reviewed independently of the feed alias.
-- No upstream is trusted by default; multiple labels from one aggregator do not count.
create table if not exists public.edgeforce_score_sources_v210 (
 source_id text primary key,
 upstream_owner text not null,
 retention_reviewed boolean not null default false,
 independent_source_enabled boolean not null default false,
 review_reference text,
 reviewed_at timestamptz,
 check(not independent_source_enabled or (retention_reviewed and reviewed_at is not null and nullif(trim(review_reference),'') is not null))
);

-- A corroborated result is a derived view: if either upstream revises a score,
-- subsequent reads automatically become CONFLICTED or SINGLE_SOURCE.
-- No cached endorsement can outlive changed evidence.
create or replace view public.edgeforce_cross_source_finals_v210 as
with latest_per_source as (
 select l.canonical_id as event_id, o.source, sr.upstream_owner, o.source_event_key,
  o.home_score,o.away_score,o.id,o.scheduled_at,o.collected_at,
  row_number() over (
   partition by l.canonical_id,o.source order by o.collected_at desc,o.id desc
  ) as rn
 from public.edgeforce_identity_links_v210 l
 join public.edgeforce_sports_outcomes_v209 o
  on l.entity_type='EVENT' and l.source=o.source and l.source_entity_id=o.source_event_key
 join public.edgeforce_score_sources_v210 sr
  on sr.source_id=o.source and sr.independent_source_enabled=true and sr.retention_reviewed=true
 where l.review_status='NAME_AND_TIME_MATCHED'
), latest as (
 select * from latest_per_source where rn=1
)
select event_id,
 count(distinct upstream_owner)::integer as sources,
 count(distinct (home_score,away_score))::integer as distinct_scores,
 min(home_score)::integer as home_score,
 min(away_score)::integer as away_score,
 case
  when count(distinct upstream_owner)>=2 and count(distinct (home_score,away_score))=1
   then 'CROSS_SOURCE_AGREED'
  when count(distinct upstream_owner)>=2 then 'CONFLICTED'
  else 'SINGLE_SOURCE'
 end as evidence_status,
 max(collected_at) as last_collected_at
from latest
group by event_id;
