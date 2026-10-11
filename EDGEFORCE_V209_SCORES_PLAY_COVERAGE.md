# EdgeForce V209 — Historical Score Observations, Play-by-Play, and Coverage Intelligence

V209 extends the first-party EdgeForce Sports Network with an explicitly permissioned pathway to retain real historical **scoreboard FINAL observations** and separately licensed **play-by-play records**. It reports missing coverage instead of treating every registered league as populated history. This is not a universal sports API or an official record certification.

## Database and evidence rules

`db/v209.sql` adds `edgeforce_sports_outcomes_v209` with source, event identity, league, teams, scheduled time, home/away scores, recorded-at timestamp and `SINGLE_SOURCE` verification status. Every distinct reported score for an event is saved as an immutable historical revision; repeat captures are idempotent. The source's native publication timestamp is **NULL** unless actually provided; the time we downloaded the scoreboard is not mislabeled as its original publication time.

Likewise `edgeforce_sports_plays_v209` accepts only separately authorized source events with source play IDs and preserves optional period, clock, player, team and limited structured statistics. It labels those records `DECLARED_SOURCE`, not automatically official. No play-by-play or player statistic is fabricated from final scores.

`edgeforce_sports_outcome_sync_v209` enforces a PostgreSQL-shared **10-minute cooldown per selected scoreboard league**, including unsuccessful upstream attempts, to avoid duplicate multi-isolate fetches. This is a manual operation, never a sports crawling cron. No external sportsbook odds request is added.

## Private APIs

- `POST /api/network/v1/outcomes/capture` with JSON `{ "feedId": "nfl", "date": "2026-10-09" }`. This manually requests **one permitted ESPN scoreboard league/date**, no farther than 14 days in the past. It accepts only actual past `post`/FINAL events with trustworthy nonnegative scores. At most **60 game revisions** are saved in one database insert. Other games remain rejected or unrecorded. The source still needs explicit retention authorization.
- `POST /api/network/v1/plays/import` with JSON `{ "source": "licensed-provider-id", "plays": [...] }`. This is for authorized server-side adapters or explicitly licensed operator uploads only. Maximum 30 plays and 24,000 JSON characters per request, with event IDs, source play keys, timestamps, descriptive provenance and bounded stats. One idempotent database insert, no upstream calls.
- `GET /api/network/v1/coverage?view=coverage` — shows records actually stored in the past 365 days for scores, plays, existing licensed player stats, archived sportsbook tape and model history. **Registry-only sports show zero**, and record counts are not misrepresented as completeness percentages.
- `GET /api/network/v1/coverage?view=scores&sport=NFL` and `view=plays` — private, limited read-only research views with provider and unverified markers.

All V209 endpoints use the **existing first-party bearer credential** verified against `EDGEFORCE_NETWORK_TOKEN_SHA256`; they do not expose source keys, account information or sportsbook credentials. The Sports Network UI now offers the source-coverage view and authorized scoreboard collection controls.

## Activation (leave off without source rights)

Set in GitHub Actions repository variables only after verifying whether a particular source permits collecting and retaining that data:

- `EDGEFORCE_OUTCOME_CAPTURE_ENABLED=true` — authorize operator-requested score capture.
- `EDGEFORCE_OUTCOME_ALLOWED_SOURCES=espn-scoreboard` — only if ESPN's applicable terms and your usage permit long-term retention.
- `EDGEFORCE_PLAY_IMPORT_ENABLED=true` — allow optional licensed play-by-play imports.
- `EDGEFORCE_PLAY_ALLOWED_PROVIDERS=your-licensed-source-name` — exact authorized provider IDs; the key itself grants no rights.

Both write flags default to disabled. These variables are validated and supplied via the existing protected GitHub Actions → Cloudflare Worker production path; no settings or upstream credentials have been changed on production. Database migration `v209.sql` must be applied before the endpoints can record or display data.

## Security and resource guarantees

Authenticated manual POST only; invalid league/date rejected before any scoreboard fetch; maximum one scoreboard league/day per invocation; 10-minute shared cooldown reserved **before** the provider call; no free-tier override and no large provider fanout. Database insert of up to 60 score revisions uses one SQL statement instead of per-game queries. Play imports up to 30 validated entries use one statement as well. Both use unique keys to suppress duplicates.

Do not classify captured final scores as independently corroborated outcomes. Model forecast calibration should use independently validated results after settlement-rule reconciliation. Projections remain models; absent player/event records remain visibly absent; this implementation never resolves missing independent bookmaker odds by calling the AI a market source.

## Verification and release

- `tests/sports-outcome-history.test.mjs` validates final-score and event identity handling, strict play inputs, preserved timestamps, private routes and resource bounds.
- `tests/sports-outcomes.postgres.mjs` runs on a *dedicated local test database* and verifies actual PostgreSQL idempotence, score corrections, play-data provenance and atomic concurrent cooldowns.
- `.github/workflows/verify-sports-warehouse.yml` runs the V208 archive tests and these V209 PostgreSQL tests with ephemeral PostgreSQL 16.

The V209 branch is preview-only until CI and hosted Cloudflare smoke gates pass. Cloudflare remains primary; Vercel remains manual-only standby. The next work should be authorized historical season backfills, team and athlete identity resolution, source conflict reconciliation, and out-of-time sports-model evaluation using genuinely settled results.