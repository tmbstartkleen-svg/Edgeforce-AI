# EdgeForce Major Build 3 — Licensed live odds and D1 provenance gate

## Observed production baseline (2026-10-21)

Cloudflare production Worker `edgeforce-ai` has a `THE_ODDS_API_KEY` secret binding, but credential presence is **not** evidence of successful requests, accepted quotes, complete market coverage, or independently verified prices.

A read-only query to production D1 `edgeforce-intelligence` returned:
- `sports_market_snapshots`: **0 rows**.
- `intelligence_sources`: one disabled `CERTIFICATION_ONLY` row; **0 enabled ODDS sources**.
- `intelligence_observations`: one old `result` record; **0 live odds observations**.

This is a D1 archive observation. The existing application also maintains other odds-fetch/store paths, which must be audited separately.

## New authenticated endpoints

- `GET /api/operations/d1-pilot/sports-market-readiness`: requires `CRON_SECRET` bearer (at least 24 characters); read-only evidence of archived rows, freshness, approved ODDS-class sources, distinct upstreams/bookmakers, sports and league inventory.
- `POST /api/operations/d1-pilot/sports-market-ingest`: requires `INGEST_SECRET` bearer (at least 24 characters) **and** `D1_SPORTS_MARKET_ARCHIVE_ENABLED=true`. This separate archive flag is explicitly `false` in both production and isolated staging configurations. Default means **no writes**.
- Input is 1–25 complete provider-originated normalized quotes, each with a real source ID/upstream ID, source event identifier, sport/league/teams, ISO event time, market/outcome, named bookmaker, valid American odds and independently recorded provider observation timestamp.
- Before any insert, the full batch must match an enabled `intelligence_sources` row of `source_type='ODDS'` and the exact upstream identifier. Certification-only sources are denied. Freshness is limited to 15 minutes and timestamps 30 seconds in the future are rejected.
- Individual rows use the preexisting append-only `sports_market_snapshots` writer, source validation, payload SHA256 and de-duplication. No wagers or automatic model probabilities.

## Deliberate restrictions

1. **Do not** enable production D1 odds writes solely because `THE_ODDS_API_KEY` exists. First verify permitted upstream service, licensing, quotas, timestamp quality and authorized archival terms.
2. The archive does **not** scrape DraftKings and does not create live provider connections by itself. A separately authorized producer must forward genuinely observed, normalized prices using the ingest contract.
3. Multiple bookmakers **from one aggregator** are *not* independent upstream services. Distinct upstreams in an inventory still do not certify overlapping canonical event/selection markets or fair odds. The readiness endpoint always reports `crossBookMarketsVerified:0`, `independentFairOddsCertified:false`, `marketCoverageComplete:false` until matched-market checks exist.
4. A count of archived odds does not imply the full DraftKings sports/props catalog is present; missing leagues/props are a separate measured release gate.
5. A single live upstream is admissible for *labeled degraded research* only; no proven +EV or independent consensus can be claimed.
6. Live upstream onboarding requires a reviewed registry write specifying `source_id`, independently established `upstream_id`, `source_type='ODDS'` and `enabled=1`; do not register generic score/fixture feeds as odds sources. **No source was activated by this build.**
7. Keep `ALLOW_DEMO_DATA=false`, autonomous ATLAS scheduling disabled, and existing production data flows unchanged.
8. Use staging first; authorizing D1 archive writes later is a separate deployment/flag change after acceptance tests and an approved source contract.

## Required evidence to close Major Build 3

- Live provider diagnostic shows source identity, license, authentic odds and time of observation without exposing credentials.
- Source registry contains explicit approved ODDS source(s); ingestion provides verified, timestamped quotes and duplicate replay behaves idempotently.
- D1 readiness shows fresh approved rows; provider outages and stale inputs are rejected/degraded, never silently classed as live.
- Independent upstream redundancy is genuinely implemented and tested. Two bookmaker aliases from one API aggregator do not meet it.
- Per-provider quota controls and failover behavior are verified against the actual connected plans and Cloudflare subrequest budget.
- Production endpoint checks and the new test suite pass; no autonomous agent activation, automatic wagering or unexplained data purchases.

## Test

`npm run test:sports-archive` (also included in `npm run verify`).
