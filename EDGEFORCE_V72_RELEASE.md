# Edgeforce V72 — Production Reliability, Drift Detection & Auto-Recovery

V72 is the first post-V71 production-hardening bundle.

## Added
- Per-intelligence-component circuit breakers
- Separate CLOSED / HALF_OPEN / OPEN states
- Two-check confirmation before required hard failures open a circuit
- Three-check confirmation for optional component isolation
- Two consecutive healthy recovery checks before automatic circuit closure
- Automatic runtime incident creation and resolution
- Protective system mode when required intelligence is isolated
- Optional component isolation for schedule, venue and movement features
- Optimizer isolation when its reliability circuit is open
- Runtime recommendation braking in degraded/protective modes
- Reliability dashboard, API, deterministic regression route and durable event history

## Failure behavior
Optional intelligence can be isolated without taking down the whole model. Required intelligence such as injury automation or validation can force protective mode, making recommendations non-actionable until recovery is confirmed.
