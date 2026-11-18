# EdgeForce integration audit — issue #509

Status: architecture audit only. No runtime feature enabled, provider requests, wagers, migrations, or deployment.

## Confirmed mainline reuse points
- `src/lib/simulation.ts`: seeded game-state Bernoulli Monte Carlo; `SimulationTier` currently caps at 100,000. This is not a correlated joint player/team game engine and does not meet the requested 500,000+ trials.
- `src/lib/modelCouncil.ts`: deterministic local ensemble of named statistical perspectives, not three independent external AI provider conversations. Do not describe it as live GPT/Gemini/Llama collaboration.
- `src/lib/playerWarehouse.ts`: player-game normalization, warehouse synchronization and feature storage. Reuse rather than introduce a parallel player database.
- `src/lib/playerCalibration.ts`: historical graded player calibration profiles and Brier score. Audit time-split leakage, data completeness and model-version provenance before claiming calibrated forecasts.

## Safe implementation sequence
1. Establish a canonical game/event and market identity contract across NBA, CBB, NFL, CFB, and existing EdgeForce providers. Inspect #507 and #503 stacked changes before reuse; do not blindly merge.
2. Implement read-only game picker and player research with explicit loading, missing-data and freshness states.
3. Add a bounded, correlated game-level simulator with configurable 500k/1m trials, convergence diagnostics, deterministic seeds, job budgets and persisted actual-run receipts. Never report requested trial counts as completed.
4. Archive immutable pregame inputs, model version, injury and quote evidence, forecast timestamp, settlement, calibration and ROI. Exclude postgame observations from pregame feature construction.
5. Add a separately feature-gated three-provider council: Analyst, Evidence Checker, Skeptic. Require real distinct provider calls and logged evidence for each turn; otherwise display OFFLINE/MANUAL. No paid fallback.
6. Implement Kalshi/Polymarket US read-only fee-, liquidity-, and settlement-aware limit entry/exit research, with source timestamp and explicit non-executable status.
7. Run focused regression tests, typecheck, lint, build, mobile QA, CI and staging certification before owner review.

## Fail-closed release rules
- Unverified injuries, roster, source timestamps, outcome identities, or calibration block positive-EV promotion.
- Historical hit rates, local ensemble votes, sportsbook implied prices, and independently calibrated model probabilities must be labeled distinctly.
- No API keys in source; no live trading, order placement, paid activation, production merge, or deployment without explicit owner approval.
- Respect existing free-tier quotas and keep all new collection disabled by default.

## Initial audit scope
Only the first portion of four existing mainline files was inspected. Other paths, production status, PR dependencies, CI, and data quality remain unverified. This document is not a completed integration or test receipt.
