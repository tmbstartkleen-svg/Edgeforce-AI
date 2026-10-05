# Edgeforce V65 — Lineup, Role & Usage Redistribution Engine

V65 converts live injury news into learned teammate opportunity changes instead of treating injuries only as a generic game-level penalty.

## Added
- Historical player-pair absence response learning
- Minutes, usage and stat-specific redistribution profiles
- Role-player filtering to focus on meaningful absences
- Live injury snapshot activation
- Severity-weighted multi-absence blending
- Bounded projection adjustment for the affected teammate
- Runtime provenance and dashboard observability
- Daily profile rebuilding from the player warehouse

## Runtime path
Historical team-event participation → player-pair role profiles → live injury feed → teammate redistribution signal → V62/V63/V64 player stack → simulation.
