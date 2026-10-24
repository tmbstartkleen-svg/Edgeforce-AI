# EdgeForce Major 23 — controlled first-party sportsbook network onboarding

## Operational state

Production D1's sportsbook archive, specialist task ledger and approved odds-source registry were each empty during an authorized read on October 24, 2026. These are real launch blockers. This build addresses the registry onboarding gate, **not** automatic live odds ingestion. It deliberately leaves the registration and archive write flags OFF in production.

## Authenticated endpoint

Cloudflare Worker: `/api/operations/odds-source-registry` (GET and POST), requiring bearer `CRON_SECRET`.

GET returns registered source IDs, upstream ownership labels, enabled state, and whether the source is allowlisted (no secrets). POST supports **PREVIEW_ONLY** or **APPLY_REGISTERED_SOURCE** with `sourceId`, `upstreamId`, `acknowledgeLicense: true`, and `enableSource: false`.

The POST can write only if the source ID is included in owner-managed `ODDS_SOURCE_APPROVED_IDS` (JSON array), the license is explicitly acknowledged, and `ODDS_SOURCE_REGISTRY_WRITE_ENABLED=true`. All three gates are required. Inserts always begin **disabled** and cannot change a registered upstream's identity. Activation requires a separate governance process and must never be inferred from a successful registration receipt. Neither method fetches paid API data.

No tokens, account numbers, provider API keys, or secrets may be submitted to the endpoint. Public fixture/scoring feeds cannot be registered as sportsbook ODDS sources unless they really provide authorized sportsbook quotes.

## Remaining milestones

1. Identify actual licensed odds feeds with contract terms, bookmaker entitlements, and documented independent upstream ownership.
2. Turn on registration briefly under owner-controlled change management, register approved source identities, then switch it off again.
3. Validate source authenticity, fields, timestamps, sport/league/prop coverage, request quotas, and model identifiers.
4. Separately authorize collector execution and gated D1 archive writes after limited canary tests; do not exhaust low remaining paid API credit reserves.
5. Demonstrate real source-observed prices at two independent upstreams before certifying cross-provider arbitrage or +EV signals.

Source labels and network persona names alone do not prove independently owned feeds or running autonomous agents.
