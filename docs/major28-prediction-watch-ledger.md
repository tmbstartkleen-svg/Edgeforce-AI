# Major 28 — D1 Prediction Watch and Review Ledger

## Purpose

Records owner-selected Kalshi market tickers and exact Polymarket YES and NO token IDs for long-dated monitoring. Adds an append-only observation ledger and a separate alert schema that is explicitly not trade certification. Unlike the independent hourly research automation, this dashboard does **not** yet run autonomous background monitoring or send push/email/SMS notifications.

## Migration and activation

The additive schema lives in `db/d1/0006_prediction_arbitrage_alerts.sql`. Apply to a controlled D1 environment only after testing and backup. The protected endpoint is `/api/operations/prediction-watches`, authenticated with the existing `CRON_SECRET`.

All reads are read-only. POST requests fail closed unless `PREDICTION_WATCH_WRITE_ENABLED=true` is explicitly configured. `REGISTER` requires a precise market/two-token mapping, explicit confirmation, and creates the watch with `enabled=0` and `settlement_verified=0`. No action in this API enables background scanning or marks a watch equivalent by itself. `OBSERVE` requires a distinct confirmation and an independently enabled `PREDICTION_ORDERBOOK_ENABLED=true` flag. It requests a bounded public book snapshot and stores only a review receipt.

## Safety gates

A quote sum under 100 cents remains `REVIEW_REQUIRED`, not certified arbitrage. No fee-adjusted ROI is asserted; no exchange rule, payout-equivalence, timestamp, or fill guarantee is inferred from contract names. The database `prediction_arbitrage_alerts` schema restricts `confirmed_executable=0` and delivery state `NOT_DISPATCHED`. Production notification delivery and legitimate net profit alerts require separate contract-rule review, exchange fee functions, executed-depth verification, price-age evidence and guarded notification channels.

**Do not** schedule the explicit observation endpoint to poll repeatedly without quota budgeting and operator approval. The existing hourly external research watch is independent of this D1 service.
