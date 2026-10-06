# Free-first sportsbook data: SharpAPI adapter

This is an opt-in, delayed pregame source, not an unlimited/live sportsbook API and not a results provider. Kalshi/Polymarket's existing public adapters are unchanged. No release gate, incident history, ledger or trade-execution control is bypassed.

## Account and deployment

Use a free SharpAPI account appropriate for personal evaluation/internal research. As checked on October 6, 2026, the provider advertises DraftKings and FanDuel, 12 requests/minute and a 60-second delay without a monthly request allowance. Its terms limit raw-data redistribution and standalone odds-comparison products. Confirm the intended use before enabling for other users; this code does not establish permission to redistribute data.

Store `SHARP_API_KEY` in the deployment's protected secret store. Set `SHARP_API_ENABLED=true` only after reviewing use rights. Missing/placeholder keys or absent opt-in leave the adapter disabled. Never commit a real key, put it in a URL, or paste it into a chat. No purchase, paid trial, signup or key creation is automated.

The adapter must share the same PostgreSQL database across enabled Vercel/Worker instances. It creates an additive `public.edgeforce_sharp_feed_v1` cache/budget table on its first enabled request, serialized with a transaction advisory lock. No historical migration is changed. The runtime account needs permission to create that optional table, or an administrator can create the exact schema from `sharedSharpFeed.ts` beforehand. An unavailable store rejects the request without an uncoordinated in-memory HTTP fallback.

The Cloudflare workflow's secret allowlist is not expanded in this change. The adapter stays disabled there until a reviewed credential-delivery change provides both variables. Vercel can inherit the protected production settings normally. Do not copy secrets out of Vercel to configure another platform.

## Request controls

One credential-hash bucket admits at most four cursor-page calls per refresh; successive refreshes start at least 65 seconds apart. Responses are limited to 200 rows/page, 512 KiB/page, and a 24-second total HTTP deadline. The lock is released before network work. A 35-second fenced lease prevents an expired owner from overwriting a later response. Shared cache reads preserve original timestamps. Rate-limit responses extend the database cooldown using Retry-After (or the rate-reset header); authentication failures cool down for an hour. There are no same-batch retries, alternate credentials, proxy rotations or paid-tier fallbacks.

This budget coordinates this adapter only. Other software using the same key still consumes provider quota. Rotating a key does not authorize bypassing limits. A lost database write is reported as a failure, not a successful cached refresh.

## Supported data and exclusions

The fixed request asks for DraftKings/FanDuel, pregame, non-futures, full-game main markets. Only complete two-sided moneylines, complementary spreads/run-lines/puck-lines, and over/under totals with matching lines are normalized. Three-way/draw, player props, alternate lines, quarter lines/Asian markets, live/started/suspended rows and ambiguous cohorts are excluded. Event identity is namespaced by provider and sportsbook; results still need explicit identifier/rules mapping before settlement.

Each accepted quote preserves source event ID, feed-delivery timestamp, declared delay and `liveEligible=false`. The generic odds normalizer carries these optional fields forward and surfaces delay/coverage warnings. Existing downstream features must not treat this as a live/executable price guarantee; this change does not certify every downstream cash-out consumer. Source age is conservative: the earlier of feed timestamp and original receipt minus declared delay, never the time of cache reuse. Rows older than five minutes or within 30 seconds of start are excluded on each adapter read.

Paging is bounded, not full-coverage proof. If more data exists after page four, a partial-coverage warning remains. No-match, cold/warming store, invalid schema, HTTP rejection and zero complete pairs remain distinguishable; an empty feed cannot certify recommendation readiness. No fake model probability or fabricated outcome is supplied.

`THE_ODDS_API_ENABLED=false` can now explicitly disable the old provider without removing its secret; `THE_ODDS_API_PRIORITY` controls its priority. Defaults are unchanged, and priority does not make the existing parallel consensus panel stop after its first provider. This patch does not disable the old provider automatically.

## Verification

`tests/sharp-api.test.mjs` executes the real TypeScript adapter against synthetic HTTP/market cases and is included in mandatory post-typecheck tests. `tests/sharp-api.postgres.mjs` uses the existing local PostgreSQL CI fixture to verify concurrent claims, shared cache, Retry-After persistence, fencing and bounded stale fallback. It refuses a non-local/non-fixture database and does not silently skip when configuration is absent. These are not evidence of successful live account access. A configured account must still pass hosted provider/data/decision checks; automatic results settlement remains a separate dependency.

## Provider documentation

- https://docs.sharpapi.io/en/api-reference/odds/
- https://docs.sharpapi.io/en/concepts/pinnacle-odds-changed-at/
- https://sharpapi.io/pricing
- https://sharpapi.io/terms
