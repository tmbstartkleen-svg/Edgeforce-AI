# Edgeforce V117 — Degraded Runtime Certification

V117 repairs the two production blockers exposed by V116.

## Verified V116 findings

Vercel successfully:
- built and deployed the staged V116 candidate
- completed runtime migration bootstrap
- certified fresh FanDuel pulse continuity
- passed strict launch doctor
- passed usable real-data verification

Hosted smoke then failed only because the expert-model endpoint was in its documented degraded state: no full normalized sportsbook slate was available while the real FanDuel pulse remained healthy.

Cloudflare completed its Worker build but failed during the pre-deploy Neon compatibility repair because a procedural SQL block was emitted as invalid `DO $` syntax.

## V117 fixes

### Degraded expert-model runtime certification

Hosted smoke now treats `/api/intelligence/expert-models` as a feature with two valid runtime states:

- live: schema is valid, catalog is present, and normalized markets are available
- degraded continuity: schema and catalog are valid, but the endpoint explicitly reports that no live/fresh stored normalized sportsbook markets are available

The degraded state is accepted only for this known contract. Other failed endpoints remain blocking.

### Procedural-SQL-free legacy database repair

The prediction snapshot compatibility bridge no longer uses `DO $$` procedural SQL.

The migration runner now:
1. inspects `information_schema.columns` in application code
2. detects whether the legacy `provider` column exists
3. backfills blank provider values from `venue`
4. drops the obsolete NOT NULL constraint
5. continues the canonical venue-based unique index repair

This avoids PostgreSQL dollar-quote parsing issues in the migration client while preserving the compatibility behavior.

## Identity

- build: V117
- app: 117.0.0
- package: 0.117.0
- model: edgeforce-v117
- migration: v114
