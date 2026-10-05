# Edgeforce V83 — Threshold Stability & Safe Rollback Governor

V83 supervises V82 adaptive thresholds for excessive drift, unstable calibration, and frequent mode switching.

## Capabilities
- scores threshold drift and instability
- detects excessive calibration/Brier deterioration
- detects frequent threshold-mode switching
- tracks the last known-safe threshold snapshot
- restores the last known-safe threshold set when instability crosses the rollback boundary
- persists stability state and rollback history
- exposes stability and rollback status in the System dashboard

## Guardrails
Rollback is limited to previously persisted threshold sets that satisfy safety-quality criteria. V83 never disables the decision gate and does not execute operational preventive actions.
