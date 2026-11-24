# Polymarket US read-only readiness

EdgeForce treats Polymarket US as a separate venue from the international Gamma analytics feed.

This integration is intentionally **read-only**. It can:
- search public US events/markets;
- resolve exact event, market, outcome and side identity for a possible Combo;
- prepare the exact leg body for operator review without submitting it;
- perform an authenticated account-connectivity check that discards balances and returns no credential values.

It cannot create a Combo instrument, submit an order, accept a stake, mutate the account, or certify a quoted price as fair value.

## Routes

| Route | Method | Behavior |
| --- | --- | --- |
| `/api/polymarket-us/status` | GET | Configuration flags only. |
| `/api/polymarket-us/search?q=...` | GET | Public market search through the US gateway; operator authorization required at EdgeForce. |
| `/api/polymarket-us/connection` | GET | Signed read-only account connectivity check; balances are discarded. |
| `/api/polymarket-us/combos/prepare` | POST | Exact selection resolution and read-only Combo body preparation. |
| `/api/polymarket-us/combos/create` | any | Rejected. |
| `/api/polymarket-us/orders` | any | Rejected. |

Except for status, EdgeForce requires an existing server-side `CRON_SECRET` or `INGEST_SECRET` bearer of at least 32 characters.

## Account keys

If the owner chooses to verify connectivity, server-side `POLYMARKET_US_KEY_ID` and `POLYMARKET_US_SECRET_KEY` may be configured through protected deployment secrets. Never put those values in source files, URLs, browser storage, logs, artifacts, or chat.

The signing helper is deliberately limited to `GET /v1/account/balances`. It cannot sign POST order or Combo-creation requests.

## Evidence rules

Preparation rejects:
- mismatched event, market or outcome IDs;
- duplicate market legs;
- closed, halted, already-started or unknown-start-time markets;
- untradable sides;
- markets without explicit Combo support;
- ambiguous side identity.

Prepared quoted prices are observations only. They are not certified fair probabilities and not evidence of future execution price or fill.

Run `npm run test:polymarket-us-readiness` for the local regression suite. The optional public smoke command makes only a credential-free event read and performs zero writes.
