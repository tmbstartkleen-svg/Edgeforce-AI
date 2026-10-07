# Edgeforce V155 — Forecast Research & Shadow Evaluation Lab

V155 adds a dedicated research-only surface for evaluating historical probability forecasts without producing real-money stake, order, or execution recommendations.

## What changed

- Adds a forecast research engine over settled historical predictions.
- Computes evidence-weighted:
  - Brier score,
  - log loss,
  - calibration error,
  - mean forecast,
  - observed outcome rate,
  - forecast sharpness,
  - and effective sample size.
- Adds 10-band reliability analysis comparing forecast probability with observed frequency.
- Adds temporal replay that compares recent versus prior forecast quality and classifies drift as:
  - STABLE,
  - WATCH,
  - DRIFTING,
  - or INSUFFICIENT.
- Builds model / sport / market research scorecards with ROBUST, QUALIFIED, WATCH, and INSUFFICIENT research grades.
- Adds deterministic report fingerprints so the same historical dataset produces the same reproducibility identifier regardless of input order.
- Adds a read-only `/api/intelligence/forecast-research` endpoint with model, sport, market, day-window, and row-limit filters.
- Adds a deterministic `/api/testing/forecast-research` regression endpoint.
- Adds a dedicated `/research` page with:
  - aggregate forecast metrics,
  - model scorecards,
  - temporal replay,
  - research-grade distribution,
  - and reliability bands.
- Adds a command-center shortcut to the research page.
- Adds mandatory unit regression, health flags, smoke checks, and release-audit certification.

## Isolation policy

V155 is intentionally research-only.

The V155 report does not expose stake sizing, order instructions, wager placement, or real-money execution controls. It evaluates historical forecast quality and reproducibility only.

## Data model

No migration is required. V155 reads the existing `historical_predictions` records and settlement-evidence metadata already produced by the prior calibration pipeline.

Cloudflare remains the production primary. Vercel remains a manual-only disaster-recovery standby.
