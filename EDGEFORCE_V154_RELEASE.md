# Edgeforce V154 — Effective-Sample Promotion Gates

V154 closes the remaining gap between evidence-weighted learning and model promotion safety.

V153 made weaker settlement evidence count less in model math. V154 makes promotion thresholds use that same effective evidence depth, so raw row volume cannot satisfy minimum-sample gates when the underlying evidence is weaker.

## What changed

- Adds shared effective-evidence sample helpers in `settlementLearning.ts`.
- Recalibration promotion now requires:
  - minimum effective total evidence,
  - minimum effective holdout evidence,
  - and the existing quality / walk-forward gates.
- Validation Lab evidence grades now use effective sample depth for:
  - insufficient,
  - provisional,
  - qualified,
  - and verified promotion levels.
- Model governance now records both raw and effective baseline/recent sample depth and marks models `INSUFFICIENT` when effective history is below the configured governance minimum.
- Champion/challenger sorting uses effective recent depth as the tie-breaker.
- Internal trained sport models:
  - filter training groups by effective evidence depth,
  - require effective total and holdout minimums before promotion,
  - and report raw plus effective depth in promotion reasons.
- External ML tournament grouping uses effective evidence depth.
- External ML promotion fails closed if the service response:
  - omits effective sample metrics,
  - has insufficient effective total depth,
  - or has insufficient effective holdout depth.
- The Python ML service independently rejects insufficient effective training and holdout depth before fitting or candidate eligibility.
- Adds a deterministic runtime regression proving that 100 MEDIUM-confidence rows count as 75 effective samples and cannot satisfy an 80-sample promotion gate.
- Adds mandatory unit regression, health flags, smoke certification, and release-audit coverage.

## Operational effect

Evidence weighting is now enforced twice:

1. **Learning math** — weaker evidence has less statistical influence.
2. **Promotion depth** — weaker evidence also counts less toward the amount of evidence required to promote a model.

This prevents large quantities of medium-confidence or legacy evidence from being treated as equivalent to the same number of fully verified outcomes.

Cloudflare remains the production primary. Vercel remains a manual-only disaster-recovery standby.
