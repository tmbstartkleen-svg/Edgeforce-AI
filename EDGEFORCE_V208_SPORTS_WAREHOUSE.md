# EdgeForce V208 — Long-Term Sports Warehouse

V208 adds **append-only, provider-attributed historical research** to the existing EdgeForce Sports Network. Its purpose is to accumulate permitted past market prices, internal forecast runs and licensed player-stat records without relying on the short live-board retention window. It does **not** backfill a century of official sports results, automatically authenticate external sportsbooks, or manufacture complete historical data. External source rights remain necessary.

## Architecture

Migration `db/v208.sql` adds `edgeforce_sports_archive_v208` with an immutable source-record identity (`record_type`, `source_record_id`), original provider, original native observation time when actually known, first archive time, event identity, start time, sport/league, subject and a bounded structured JSON payload. A separate `edgeforce_sports_archive_sync_v208` tracks a monotonic cursor, copied count and one-minute shared cooldown per archive type. Repeated imports use `ON CONFLICT DO NOTHING`; older archive entries are never rewritten by a later quote.

Three classes are supported: `MARKET_OBSERVATION`, `MODEL_FORECAST`, and `PLAYER_STAT`. Market tape stores original bookmaker, selection, American odds, source timestamp field if supplied, and time the feed was received. Internal model history stores probabilities, model version, simulations and Monte Carlo sampling intervals—**not actual outcomes**. Player stats are never archived without separate source-rights opt-in.

## Private endpoints

- `GET /api/network/v1/archive?view=status` — archive stream counts, cursor and next eligible batch time.
- `GET /api/network/v1/archive?view=records&kind=MARKET_OBSERVATION&sport=NFL&limit=30` — read a page of private historical records, with `nextBefore` for pagination. Max 50 entries. Other kinds: `MODEL_FORECAST`, `PLAYER_STAT`.
- `POST /api/network/v1/archive/sync` with body `{"kind":"MODEL_FORECAST"}` — import **at most 80** earlier records from the existing EdgeForce database. Operator-initiated only; one-minute cross-worker cooldown. Never calls an upstream API, a model, an external scoreboard, or an order execution endpoint.

All endpoints require the **same** `EDGEFORCE_NETWORK_TOKEN_SHA256` protected owner credential introduced in V205. In the Sports Network sidebar, the **Historical data warehouse** section lets the authorized operator check source coverage, read actual rows, and request one backfill batch manually. A private password-style token is not retained in localStorage.

## Activation and source rights

By default **all archive writes are disabled**. After V208 is migrated and verified, an operator can configure GitHub Actions repository variables:

- `EDGEFORCE_ARCHIVE_WRITES_ENABLED=true` — permits manual archive writes.
- `EDGEFORCE_ARCHIVE_ALLOWED_PROVIDERS=provider-id-1,provider-id-2` — exact provider IDs whose contracts explicitly allow this degree of retained historical market or player data. **Do not add ESPN, Sharp or any licensed provider merely because the API is accessible; verify terms and retention rights first.**
- `EDGEFORCE_ARCHIVE_PLAYER_STATS_ENABLED=true` — separate optional player-stat archiving switch, only if permitted by the chosen provider's license.

V208 delivers these operator variables through the protected Cloudflare GitHub Actions runtime configuration. A missing or invalid allowlist blocks external-data archive writes. Model forecast records are internal, but manual writes still require `EDGEFORCE_ARCHIVE_WRITES_ENABLED=true`. If the database or migration is missing, the system fails closed. No automatic daily backfill cron is introduced.

## Limits and release controls

Each request reads and inserts at most 80 existing records from a single source table, in one PostgreSQL transaction. Row locks and cursors coordinate parallel workers; failed transactions do not advance cursors. Provider rights are checked before market or player-stat copying. The archived history API is read-only and paginates rather than returning thousands of rows. Cloudflare Worker CPU and database limits are respected by avoiding recursive source polling, large backfills and per-game remote calls.

Historical events that have no official final-score source are still labeled **not verified**. Archived model probabilities must not be relabeled as settled outcomes, market consensus or high-confidence bet signals. The existing odds-provider warning remains valid until actual independent sportsbook feeds are activated.

## Tests

- `tests/sports-warehouse.test.mjs`: source allowlist validation, migration uniqueness and timestamp semantics, bounded query and authentication safeguards, manual UI checks.
- `tests/sports-warehouse.postgres.mjs`: optional fixture-only real PostgreSQL integration for permitted source copying, conflict idempotency, shared cooldown and separate model/player provenance. Run against a dedicated loopback `edgeforce_snapshot_test` PostgreSQL database with `WAREHOUSE_TEST_DATABASE_URL`; **never** aim the fixture test at production.

## Next milestone

V209 should add source-licensed official final scores and play-by-play ingestion, canonical team/athlete IDs, coverage maps by sport and season, per-provider retention policies and time-based calibration dashboards. Continue as preview-only until CI, licensing review and hosted checks pass. Cloudflare remains primary and Vercel remains manual-only standby.