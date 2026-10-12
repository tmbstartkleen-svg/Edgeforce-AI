# EdgeForce Specialist Network — architecture contract

The specialist network defines **work roles**, not running bots. Neither declaring a persona nor listing a sport means a licensed data feed exists, a simulation was run, or a market was scanned. Runtime activation is gated on D1 write/read certification, provider source registration, budgets and observability.

## Divisions

- SPORTS: one analyst persona per named sport plus OTHER_SPORTS. Coverage is extensible from an authorized sportsbook *catalog* obtained through an approved API; DraftKings names are a coverage goal, not an assertion that a private DraftKings feed exists.
- PREDICTION_MARKETS: an explicitly separate non-sports workspace for politics, economics, finance, crypto, weather, climate, technology, entertainment, culture, science and geopolitics. Includes settlement rules, contract identity, market prices, provenance and calibration. Sports-related event markets belong in SPORTS, not duplicated here.
- PLATFORM: sports research, market comparisons, software engineering, interface design, history stewardship, data-quality, reliability, event modeling and source-license review.

## Canonical evidence

Use domain namespace + provider/upstream + source event and market IDs; don't conflate a non-sports contract with a match just because IDs overlap. Preserve original upstream observedAt, ingestion timestamp, original raw payload hash, license metadata, outcomes and historical versions. Never upgrade single-book data to independent validation and never invent probabilities or results.

## Existing data preservation

Neon is currently quota-suspended. No existing Postgres table should be dropped, overwritten or auto-cleaned. D1 is initialized separately. Historical data migration requires restored source access, export checksums, row counts and sample comparisons before any retirement of Neon. D1 free quotas require batching, deduplication, sampling/rollups and cold historical archive such as R2 as allowed by project limits.

## Activation sequence

1. Validate the D1 Worker persistence certification.
2. Register one allowed source and its permitted retention/use terms; enable only a bounded test lane.
3. Persist real timestamped observations and verify exact readback / duplicate handling.
4. Add category segregation and source coverage audits.
5. Schedule limited sport and non-sport collectors with backoff, budget caps, rate-limit awareness, and failure handling.
6. Validate simulations and resolved prediction-market forecasts out-of-sample.
7. Build separate product navigation: Sports / Non-Sports Prediction Markets / Agents & Sources / Archive / Engineering & Operations.

Personas must not claim to be autonomous ChatGPT sessions. Real scheduled bots require a runtime, data access, budgets and credentials.
