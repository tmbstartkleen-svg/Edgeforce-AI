# Edgeforce V96 — Unified Supervision Cycle Context

V96 consolidates the preventive supervision pipeline into a single evidence-bearing cycle.

## Capabilities
- minute-bucket idempotent supervision-cycle snapshots
- reuses incident-pattern + observability evidence for predictive risk
- reuses predictive-risk + action-learning evidence for ranking
- reuses decision-calibration evidence for threshold derivation
- reuses ranking + observability + effective thresholds for the decision gate
- persists cycle evidence digest and output summaries
- keeps V94/V95 baseline-governance locking and watchdog protections intact
- exposes supervision-cycle status in the System dashboard

## Guardrails
V96 does not relax any risk, threshold, baseline, release, or operational-action guardrail. Existing standalone APIs remain backward-compatible.
