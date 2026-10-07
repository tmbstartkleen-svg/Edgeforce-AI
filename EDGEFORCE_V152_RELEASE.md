# Edgeforce V152 — Evidence-Aware Model Learning

V152 connects settlement provenance to the model-learning pipeline so weak settlement evidence cannot influence automatic calibration, governance, validation, or model promotion as if it were fully verified.

## Learning policy

- `PROVIDER_NATIVE`: eligible for automatic learning at full evidence weight.
- `CORROBORATED_SCORE / HIGH`: eligible at full evidence weight.
- `CORROBORATED_SCORE / MEDIUM`: eligible with reduced evidence weight.
- `TRUSTED_PRIMARY_SINGLE`: settlement-valid, but excluded from automatic model promotion and training.
- Unknown explicit evidence: excluded from automatic learning.
- Pre-V152 legacy historical rows: retained for backward-compatible learning with a legacy evidence marker.

## What changed

- Historical prediction feedback now stores both the V151 settlement provenance and a derived V152 settlement-learning policy inside the prediction feature snapshot.
- Recalibration filters explicitly ineligible settlement evidence before computing calibration profiles and learned model weights.
- Model governance uses the same eligibility gate before champion/challenger and drift decisions.
- Validation Lab filters the same weak evidence before promotion-quality evaluation.
- Internal trained sport models exclude ineligible settlement evidence.
- External ML tournament training payloads exclude the same ineligible rows.
- Recalibration, governance, internal training, and external training expose rows read, rows excluded by evidence, and settlement-learning summaries where applicable.
- Adds deterministic unit and runtime regression coverage, mandatory post-typecheck enforcement, health flags, smoke checks, and release-audit certification.

## Compatibility

V152 does not discard existing historical learning data. Legacy rows without settlement provenance remain eligible so the current sample base is preserved. The stricter policy applies to newly provenance-aware results going forward.

V152 changes learning eligibility only. It does not change the V150 settlement decision policy, the Cloudflare-primary production topology, or the manual-only Vercel standby policy.
