# Unified Game Intelligence — implementation contract

Issue: #509. Status: development, NOT deployed.

## Scope
- NBA, NCAAM basketball, NFL and NCAAF date/sport/game selector with automatic schedule retrieval and clear unavailable states.
- Selected game displays official roster and injury status, last 5/7/10/20 player logs, prop lines, moneyline, spread and totals with source timestamps.
- Reuse existing simulation and modelCouncil code. The current simulation tier ceiling is 100,000; 500,000+ is a **target**, not yet an implemented or measured capability.
- Use a coherent correlated game-state distribution for team totals, margins and player statistics; never multiply independent leg probabilities for same-game outcomes.
- Before running, validate roster, injuries, projected participation, source freshness and model version. Missing information must block VERIFIED status.
- Save immutable forecast snapshots with input provenance, timestamp, model version, simulation count, market quote and calibration state. After settlement, compare to actual outcomes and track calibration, Brier score and log loss using chronological holdouts.
- Sports-Collab council: three distinct **real** provider calls (analyst, evidence checker, skeptic) with source-grounded debate rounds and dissent log. Existing src/lib/modelCouncil.ts is a numerical ensemble, NOT a live three-provider AI debate. Do not label it as such.
- Strict $0 mode: if provider cost/free allowance cannot be verified, keep it disabled. Never use fallback to a paid provider. Store secrets server-side; do not log or commit keys.
- Read-only: no wagers or external order submissions. No production merge or deployment until tests and owner review.

## Acceptance gates
1. Mobile game picker uses live schedules; tests cover empty, stale and provider failure states.
2. Injury and roster provenance is visible, with blocked simulations on unresolved critical availability.
3. Verified Monte Carlo 500,000+ execution with runtime and convergence benchmarks, capped resource usage and caching.
4. Probability outputs are distinguished from historical hit rates and are calibrated on unseen historical games.
5. Real provider council shows actual model identities and timestamps, disagreement, transcript and offline/manual status.
6. Lint, typecheck, targeted tests, and mobile QA pass before production release.
