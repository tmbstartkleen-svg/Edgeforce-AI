# Edgeforce V132 — Remediation Certification Continuity

V132 repairs the production certification stage that followed the successful V131 launch-doctor fix.

## What changed

- Strict production certification now loads provider certification evidence for the exact deployment commit.
- A remediation candidate can recognize a freshly certified normalized ODDS provider even when the ingest layer is temporarily serving a stored slate.
- Stored remediation continuity requires non-empty markets and a non-REJECT data-quality grade.
- Known settle/decision continuity failures, blocked unified intelligence, protective reliability, and CRITICAL observability can be treated as inherited remediation warnings only when bounded continuity evidence exists.
- Ordinary strict production certification remains fail-closed outside remediation mode.
- Comparative canary, SLO, V1 readiness, and promotion checks remain mandatory.

## Why

V131 correctly passed strict launch doctor, sportsbook validation, hosted smoke, execution certification, and attestation. Final production certification still rejected the staged candidate because it only recognized a narrow pulse-only continuity shape. V132 aligns the final certification gate with the existing staged-remediation architecture without bypassing promotion safety gates.
