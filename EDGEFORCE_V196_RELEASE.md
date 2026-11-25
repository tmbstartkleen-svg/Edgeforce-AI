# EdgeForce V196 — Verified Edge Evidence Join

V196 closes the gap between provisional market-reference value math and evidence-backed independent-model review.

## What V196 does

The existing authenticated D1 Opportunity Review now performs a read-only evidence join across:

- fresh, source-dated archived sportsbook quotes from approved D1 source registrations;
- exact stored model runs for the same event, market and selection;
- model-run feature evidence declaring independent probability origin and out-of-sample validation;
- prior validation-lab evidence with a QUALIFIED or VERIFIED promotion grade;
- prior calibration rows that satisfy EdgeForce promotion thresholds;
- exact post-forecast, pregame target-book and corroborating quote observations.

Only rows that survive every identity, chronology, calibration, validation and positive-EV gate can appear as CANDIDATE_FOR_FURTHER_REVIEW.

## What V196 does not do

V196 does not poll sportsbooks, infer win probability from price, place an order, size a wager, authenticate legal ownership of an upstream operator, or authorize production betting.

For compatibility and safety, the endpoint still returns modelVerifiedEdges as an empty array, leaves modelCalibrationCertified and independentOperatorOwnershipCertified false, keeps productionBetRecommendationAuthorized false inside every candidate, and performs zero external requests and zero orders.

The Operations UI labels these rows Independent-model edge review and Review only. A missing evidence join remains empty and displays blocker counts rather than inventing a model probability.

## Evidence thresholds

The D1 calibration row must predate the forecast and meet the same minimum promotion-quality thresholds used by the validation system: at least 75 samples, Brier <= 0.28, log loss <= 0.78 and calibration error <= 0.10. The model run must additionally carry a prior validation-lab evidence ID and promotion-eligible QUALIFIED or VERIFIED grade.

These checks are necessary evidence gates, not a guarantee of future performance or executable availability.
