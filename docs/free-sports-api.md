# Free sports API gateway

Status: implemented locally; account key authenticated on 2026-10-25. Not deployed or connected to the production dashboard. Sports and leagues catalog requests succeeded, but a dated NBA schedule request returned mismatched leagues and stale dates. Schedule quality verification failed. This gateway covers the sports actually returned by BetStack, not every sport in existence.

The supplied Muse guide was checked against https://api.betstack.dev/docs and https://sharpapi.io/pricing on 2026-10-25. BetStack documents one request per 60 seconds per key, consensus odds, dynamic sports/leagues and separate events/results/lines/teams collections. Its docs permit personal and commercial use. SharpAPI already has an opt-in adapter in src/lib/providers/sharpApi.ts; the published free plan has two sportsbooks, 12 requests/minute and a 60-second delay. FieldFunded is another candidate but its precise available leagues and response contracts have not been integrated or verified.

## Run locally

Set BETSTACK_API_KEY to the key received through your own account and FREE_SPORTS_API_TOKEN to a separate randomly generated operator token of at least 24 characters in the server environment. Never put these in client code, URLs, source control, screenshots or chat. Run `npm run serve:free-sports`. Default address is `http://127.0.0.1:8788`; FREE_SPORTS_API_PORT may select another local port.

All routes require `Authorization: Bearer <operator token>`. There is no CORS or public listener.

- GET /api/sports/v1/coverage — local configuration/capability status; does not claim working connectivity.
- GET /api/sports/v1/sports — provider sport catalog.
- GET /api/sports/v1/leagues — discover real league keys.
- GET /api/sports/v1/events?league_key=basketball_nba&date=2026-10-26 — schedules.
- GET /api/sports/v1/results?league_key=basketball_nba — scores/results.
- GET /api/sports/v1/lines?league_key=basketball_nba — consensus prices, always explicitly labelled, never executable sportsbook odds.
- GET /api/sports/v1/teams?league_key=basketball_nba — team data.

The envelope includes provider, resource, receivedAt, cached and data. The `data` field retains the documented provider collection schema. Retrieval time is not source observation time. Injury availability, simulation availability, source timestamp verification and complete coverage remain uncertified. The gateway does not generate probabilities.

## Quota and failure behavior

A single running process serves a single key. All endpoints share one upstream request per minute. Identical requests can use the 60-second cache. Other requests during cooldown receive 429 and Retry-After. Upstream Retry-After extends cooldown. Failed requests also consume the local interval. Authentication, unknown routes and bad filters do not call upstream. Responses are bounded to 2 MB, requests time out after 10 seconds and redirects fail closed. Raw upstream errors and API keys never appear in errors.

This is NOT a distributed limiter. Do not run several instances with the same key or share that key with another collector. Restarts erase cache and cooldown: wait at least 60 seconds after the last upstream request before restarting, or honor a longer upstream Retry-After. Production integration requires durable per-key rate state and a verified account before enabling collection. No paid provider, automatic polling, D1 archive write or scheduled execution is enabled by this change.

## Activation still required

The account credential is saved outside the repository in an owner-only local file. Production secret installation remains pending. Resolve the schedule mismatch and verify sample events and lines sequentially respecting the rate limit before activation. Catalog presence alone does not prove usable odds or injuries for every league. Keep source gaps visible. Any separate provider signup that asks for payment or a paid trial is out of scope.

See [coverage audit](sports-data-coverage-audit.md) for evidence and additional providers. Event responses now fail closed when requested league or UTC date does not match the returned records. Other response contracts and freshness still require verification.
