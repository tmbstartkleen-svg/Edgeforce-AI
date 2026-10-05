# Edgeforce V100 — Post-Promotion Live Verification

V100 closes the release handoff gap between CI approval and the live runtime.

## What V100 adds
- durable post-promotion verification certificates
- live runtime identity verification after production promotion
- exact commit agreement across deployed runtime, execution certification, and promotion provenance
- dashboard visibility for the latest live verification certificate
- production workflow enforcement after provenance is written
- release-audit and smoke coverage for the new verification path

A missing V100 post-promotion certificate is warning-level while the first V100 deployment is bootstrapping. Once a certificate exists, a failed or commit-mismatched verification becomes a strict production blocker.
