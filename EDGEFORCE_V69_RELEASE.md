# Edgeforce V69 — Market Movement & Closing-Line Learning

V69 upgrades the existing exact-ID line history into canonical market learning.

## Added
- Canonical event / market / selection identity across line-point changes
- Opening-to-current probability movement
- 60-minute momentum and velocity
- Spread / total / prop point movement
- Steam detection and reversal detection
- Sharp-vs-public gap feature
- Bounded closing-line signal weighted by historical closing-line skill
- Settled CLV profiles by sport and market
- Offered-vs-closing Brier comparison and market efficiency
- Canonical closing-line inference when settlement providers omit a close
- Durable movement snapshots, profile rebuilds, API, regression route and dashboard
- Simulation integration across fallback, team-score, prop, micro and shared-event paths

## Guardrail
Market movement is treated as a small evidence layer. It cannot replace the native EdgeForce model and is attenuated when historical closing-line evidence is weak.
