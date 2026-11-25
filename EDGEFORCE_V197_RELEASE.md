# V197 — research evidence integrity

V197 corrects cases where the research interfaces could display stronger or more current evidence than the stored data supports. It builds on V195's daily/weekly cockpit and V196's read-only D1 model/quote/calibration review.

## Research board

- Today and Next 7 days use explicit America/New_York calendar boundaries and exclude events that have already started. Provider bucket labels cannot override the event timestamp.
- AM/PM uses the same time zone. An invalid event time is not classified as PM.
- Meeting board filters requires explicit qualification metadata, finite simulation and confidence values, valid American odds and current source age. Context must be ready when supplied. A grade label alone is insufficient.
- Fractional expected return is converted to a percentage consistently, including values greater than 100%.
- Loading, failed and missing snapshots remain unavailable. Superseded requests cannot restore stale data after a later request or component cleanup.
- The cockpit describes its returned snapshot limit; it does not imply complete league or market coverage. Refresh remains manual after the initial load.

## Stored evidence review

- D1 calibration metrics must be finite numbers. Nulls, blanks, booleans, arrays and numeric strings cannot turn into perfect scores of zero.
- Calibration must match the model version, market and explicit sport. Its measurement period must end by the calibration record's creation, which must precede the forecast.
- Both model and quote schedules must still be upcoming. Pregame observations expire for this review when the event begins, even inside the quote freshness window.
- Conflicting latest target-book prices at the same timestamp produce `CONFLICTING_LATEST_TARGET_QUOTES`. Price-derived metrics remain unavailable until an unambiguous latest quote exists. Identical duplicate prices remain valid.
- Validation IDs and grades are labeled as model-supplied assertions. The response explicitly reports `validationEvidenceIndependentlyVerified: false`; this release does not join independently authenticated validation records.

## Verification and release

The existing mandatory typecheck, research-pipeline and D1 review suites cover the changes. Regression cases include missing calibration scores, score thresholds, calibration chronology and sport mismatch, event-start boundaries, order-independent quote conflicts, duplicate observations, exact prop identity, calendar boundaries, qualification metadata and request invalidation.

The deployment authority documentation now matches the existing automatic main-branch workflow and its exact-commit verification gates. Production deployment, credentials, schemas, collection schedules and provider budgets are unchanged. V197 is a feature milestone; the runtime version remains 119.0.0 / edgeforce-v119.

## Evidence boundary

Research candidates remain review-only. `modelVerifiedEdges` stays empty, production betting authorization stays false, and this change places no orders or adds provider polling. The existing live-board endpoint can still ingest provider data when requested; local filters do not add requests. Passing code and deployment checks does not establish live bookmaker availability, independent upstream ownership or profitable model performance.
