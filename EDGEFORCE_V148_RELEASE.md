# Edgeforce V148 — Cross-Source Live Score Consensus

V148 builds on the V147 freshness governor by validating live game state across multiple providers instead of trusting one selected feed silently.

## What changed

- Keeps all live observations for each game before selecting the best row.
- Adds source-aware score corroboration with HIGH, MEDIUM, LOW, and SINGLE_SOURCE confidence.
- Separates older lagging feeds from true contemporaneous score contradictions.
- Detects score and game-status conflicts and exposes them in every selected live-game record.
- Publishes live corroboration rate, conflict rate, source count, and conflict totals in the score-mesh response.
- Surfaces source count, confidence, lagging providers, and CONFLICT state in the dashboard.
- Adds configurable consensus and lag windows for Cloudflare production.
- Adds a deterministic runtime regression endpoint plus smoke, health, unit-test, and release-audit certification.

## Default production policy

- Consensus window: 8 seconds.
- Lag tolerance: 3 seconds.
- A stale divergent feed can be classified as lagging without downgrading an otherwise corroborated live score.
- A contemporaneous contradictory score is never hidden; it is surfaced as an active conflict.
- High-trust league-native and ESPN feeds remain eligible to lead during rapid scoring transitions, but their confidence is reduced when same-time evidence conflicts.

V148 does not change the production topology. Cloudflare remains primary and Vercel remains a manual-only disaster-recovery standby.
