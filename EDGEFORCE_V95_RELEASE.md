# Edgeforce V95 — Governance Watchdog & Stale-Lease Recovery

V95 hardens V94 against crashed, abandoned, or unusually long governance cycles.

## Capabilities
- per-step heartbeat renewal for the V94 90-second lease
- stops a cycle if its lease is lost
- detects STARTED cycles with no heartbeat for three minutes
- marks stale cycles FAILED with explicit watchdog attribution
- clears expired governance locks
- runs V93 consistency reconciliation after stale-cycle recovery
- records watchdog recovery and lease-loss history
- exposes watchdog state in the System dashboard

## Guardrails
V95 only protects execution state and recovers stale governance metadata. It does not change promotion criteria, threshold influence, or operational preventive actions.
