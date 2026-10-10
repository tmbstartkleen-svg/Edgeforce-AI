# EdgeForce V187 — Mobile + Live Board UX

V187 is a post-production design/testing refinement built on the certified V186 baseline.

## What changed
- Adds Live Scores as a first-class quick-navigation target.
- Converts the live score mesh into responsive score cards with team scores, clock/period, source, consensus confidence, and conflict state.
- Keeps the full 19-column probability table on desktop.
- Replaces that dense table with touch-first probability cards on small screens.
- Surfaces SIM, odds, confidence, edge, robustness, venue, grade, and Explain action directly on mobile.
- Increases mobile touch targets for quick navigation and Explain actions.

## Runtime impact
- No provider additions.
- No new network requests.
- No ranking, qualification, simulation, settlement, or deployment-topology changes.
- Uses only data already present in the existing live-board payload.

## Test coverage
- Dashboard information-architecture test verifies live navigation and both desktop/mobile board surfaces.
- Release audit verifies the V187 UX contract.
