# V205 — EdgeForce Sports Network (first-party research API)

EdgeForce now has private, owner-controlled API routes built on the platform's already-collected, authorized sportsbook market snapshots and stored upcoming event records. **This does not turn ChatGPT into a vendor credential or create unlimited access to upstream odds.** Models may interpret evidence; only real sources can supply market observations.

## Private API routes

- `GET /api/network/v1/markets?limit=60&sport=NFL` — returns no more than 100 stored market observations per call, with bookmaker, upstream provider, source timestamp, pull timestamp, conservative quote age, market key and event identity. The backend examines a bounded 750 most recent observations, drawn from stored pregame records in the next eight days. No additional external request is made.
- `GET /api/network/v1/events?limit=50&sport=NFL` — returns no more than 100 stored future schedule events. Schedules are historical database observations, not a live score feed. The endpoints are separate from EdgeForce's existing `/api/live-scores` mesh.

All records carry research-only provenance. A model inference is NEVER entered into the bookmaker tape as an independent provider. No executable quotes, venue orders, account authorization, bankroll operations or implied 'independent consensus' are inferred.

## Setup a first-party network key (Mac Terminal)

Generate your own random API token and store a SHA-256 hash of the token in the Cloudflare Worker environment. Example commands (run them **locally**, not in GitHub Actions output, chat, or the browser console):

```bash
umask 077
openssl rand -hex 32 > edgeforce-network-token.secret
shasum -a 256 edgeforce-network-token.secret
```

**Important:** `shasum` of the file includes a trailing newline only if your file has one. `openssl rand -hex 32` writes a newline. The authentication service hashes the hex token text *without* a newline. Use this command instead to calculate the exact stored hash:

```bash
tr -d '\n' < edgeforce-network-token.secret | shasum -a 256
```

Add only the resulting 64-digit SHA256 hash as `EDGEFORCE_NETWORK_TOKEN_SHA256` in **Cloudflare Workers & Pages → edgeforce-ai → Settings → Variables and Secrets** as an encrypted secret. Keep the original 64-digit token safe and private. This private first-party token is unrelated to `THE_ODDS_API_KEY`, `SPORTS_GAME_ODDS_API_KEY`, or `AI_GATEWAY_API_KEY`. Don't commit the `.secret` file. Delete your temporary local token file securely after moving it to your password manager.

Use the token in a private server-to-server client (not a public browser page):

```bash
NETWORK_TOKEN="$(tr -d '\n' < edgeforce-network-token.secret)"
curl --fail-with-body -H "Authorization: Bearer $NETWORK_TOKEN" \
  'https://edgeforce-ai.tmbstartkleen.workers.dev/api/network/v1/markets?limit=10&sport=NFL'
```

Without the configured SHA256 hash, both routes fail closed with `NETWORK_KEY_NOT_CONFIGURED` (HTTP 503). Without the correct Bearer token, they return HTTP 401. Without a working shared database, they return HTTP 503 and do not fetch external odds. This is by design.

## Source completeness and rate constraints

- EdgeForce can query its legitimately stored internal records repeatedly, but Cloudflare CPU, hosting bandwidth, PostgreSQL storage, AI model tokens, and vendor data contracts remain finite.
- Bookmaker snapshots older than 2 minutes are marked `STALE`, even though read-only historical responses may include them. Snapshots with absent or invalid source timestamps are `UNVERIFIED`.
- The platform's single ESPN source and single DraftKings bookmaker will continue to show one provider and zero multi-book markets until authorized feeds actually supply independent bookmaker prices.
- This API does not grant rights to redistribute third-party commercial odds or protected league tracking beyond the original vendor license. Review vendor terms before making any data commercially/publicly available.
- Cloudflare production deployment and Vercel standby are unchanged. This is a preview-only PR until review and all checks pass.

## Recommended next builds

Store source-native score snapshots through already-approved score ingestion, preserving observed time, then expose a separate first-party scores endpoint with TTL/rate gates. Add globally coordinated query quotas for external customers, role-based credentials, source licenses, retention policy, telemetry, and per-league data-quality SLAs before opening this network publicly. Keep AI reasoning as a separately billed and quota-protected service rather than an odds source.