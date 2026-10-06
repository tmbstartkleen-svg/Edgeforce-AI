# Edgeforce V115 — Release Path Convergence

V115 repairs the final release-mechanics blockers exposed by V114.

## Verified V114 findings

Cloudflare successfully:
- deployed V114
- converged to exact release identity
- certified real sportsbook continuity through the fresh FanDuel pulse
- passed usable-live-data verification
- passed prediction-terminal verification
- passed iPhone/PWA surface verification

Cloudflare then failed only while priming the prediction intelligence warehouse because that endpoint returned HTTP 500.

Vercel successfully completed the production build and entered staged remediation mode, but the candidate deployment failed before launch because a production-target prebuilt artifact was being deployed as preview. Vercel rejected the target mismatch before any hosted V114 candidate ran.

## V115 fixes

### Staged Vercel candidate target convergence

The remediation path now builds a preview-target prebuilt artifact for the staged candidate.

The candidate still receives production runtime environment flags and remains unpromoted until all hosted launch gates pass. Only after certification does Vercel promotion move the exact tested deployment to production.

This removes the prebuilt environment mismatch without weakening the staged-promotion safety model.

### Prediction intelligence fail-soft priming

Prediction intelligence collection now treats auxiliary source and persistence failures independently.

- Kalshi trade collection can fail without discarding Polymarket/contracts.
- Polymarket trades can fail without discarding Kalshi/contracts.
- leaderboard enrichment can fail independently.
- market, trade, signal, and public-trader writes each report their own persistence warning.
- warehouse statistics failures are exposed as degraded diagnostics.
- partial real prediction-market data returns HTTP 200 with `degraded:true` and explicit warnings instead of a generic HTTP 500.

The endpoint still reports complete failure through its outer exception boundary for genuine processing failures.

### Deployment evidence

Cloudflare warehouse priming now captures the HTTP status and response body before deciding whether the gate passed. This ensures any future failure is immediately actionable in CI logs.

## Identity

- build: V115
- app: 115.0.0
- package: 0.115.0
- model: edgeforce-v115
- migration: v114
