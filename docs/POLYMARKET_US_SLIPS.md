# Polymarket US selections and Combos

This integration targets the US retail API. It is separate from the existing
international Gamma analytics provider. It prepares exact selections and can
create an exchange Combo instrument; it never enters a stake or submits an order.

## Account connection

Generate a Key ID and Secret Key at https://polymarket.us/developer using the same
sign-in method as the verified US app account. Store them as server-only
`POLYMARKET_US_KEY_ID` and `POLYMARKET_US_SECRET_KEY` deployment secrets. Do not put
them in source files, URLs, browser storage, or chat. This cannot be completed by
installing an SDK alone: the account owner must authenticate to Polymarket.

`POLYMARKET_US_COMBOS_ENABLED=true` opts into creating Combo instruments after
authentication has been verified. It does not enable trading. Credentials are
signed with the same Ed25519 timestamp + method + path format as the official US
SDK, using Web Crypto so Node and Cloudflare share the same implementation.

## Endpoints

| Route | Method | Behavior |
| --- | --- | --- |
| `/api/polymarket-us/status` | GET | Configuration flags only; configured keys are not proof of authentication. |
| `/api/polymarket-us/connection` | GET | Authenticates against the account API; returns no balances or credentials. |
| `/api/polymarket-us/search?q=Bills` | GET | Searches public US events and markets. |
| `/api/polymarket-us/combos/prepare` | POST | Resolves exact outcomes and prepares the Combo body without creating it. |
| `/api/polymarket-us/combos/create` | POST | Revalidates every outcome and creates the Combo instrument when enabled. |

Except for configuration status, endpoints require an existing operator
`Authorization: Bearer <CRON_SECRET or INGEST_SECRET>` of at least 32 characters.
Keep this authorization server-side. Cloudflare routes use Worker bindings;
Next.js routes use server environment variables.

Both Combo routes accept:

```json
{
  "selections": [
    {"eventSlug": "exact-event-a", "marketSlug": "exact-market-a", "outcomeId": "123"},
    {"eventSlug": "exact-event-b", "marketSlug": "exact-market-b", "outcomeId": "456"}
  ]
}
```

These are placeholders, not betting recommendations or reusable market IDs.
For creation, also include `"action": "CREATE_COMBO_INSTRUMENT"`.

Resolve actual events and outcome IDs from current public US data. The resolver
rejects mismatched event/market IDs, duplicate markets, absent labels or start
times, already-started events, closed or halted markets, untradable sides, and
markets without explicit Combo support. The selected side's explicit `long`
boolean determines `SIDE_BUY` or `SIDE_SELL`; title wording and side order do not.
Same-game or other combination restrictions remain subject to exchange rejection.
Quoted prices are observations, not verified fair probabilities or executable
Combo prices. No automatic retries are performed after creation requests.

## Native app links remain a separate verification step

`POST /v1/combos` returns an opaque exchange instrument ID, such as `crossd-...`.
The documented response does not contain the short share ID previously observed
in native app URLs. The adapter returns `appUrl: null` and
`appPreloadVerified: false`. It never invents a `/combos/{id}` URL.
Individual event links are explicitly labeled navigation only. A real app share
link and a successful iPhone test are still needed to establish slip preloading.

## Validation

Run `node --test tests/polymarket-us-slips.test.mjs` for authentication signatures,
selection identity, closed-market rejection, request gating and response matching.
`node scripts/polymarket-us-smoke.mjs --event <current-event-slug>` performs a
public read only and prints a compact connection/market summary. It makes no
authenticated requests, creates no instruments, and submits no orders.

Official references:

- https://github.com/Polymarket/polymarket-us-python
- https://docs.polymarket.us/api-reference/authentication
- https://docs.polymarket.us/api-reference/events/get-event-by-slug
- https://docs.polymarket.us/api-reference/combos/overview
