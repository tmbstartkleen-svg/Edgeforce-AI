# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V20 Model Calibration Intelligence

### Added in V20
- sport-specific model performance
- market-type-specific performance
- rolling model rankings
- recency/confidence decay with a 45-day half-life
- probability calibration buckets
- over-confidence detection
- under-confidence detection
- mean absolute calibration error
- confidence labels: HIGH, MEDIUM, LOW, INSUFFICIENT
- model-performance API
- calibration-profile API
- V20 calibration/ranking tables

### V20 APIs
- `GET /api/intelligence/model-performance`
- `GET /api/intelligence/calibration-profile`

Optional query parameters:
- `sport`
- `market`
- `model` for calibration profiles

### Why V20 matters
A model that works well in MLB moneylines should not automatically receive the same trust in NBA player props. V20 separates model evidence by sport and market, measures calibration, and reduces the influence of older performance over time.

### Confidence decay
Historical performance uses recency decay rather than treating every old prediction equally. The default half-life is 45 days.

### Database
Apply migrations through:
```
db/v20.sql
```

All existing provider, data-quality, portfolio, release, monitoring, smoke, and rollback safeguards remain active.

## Guardrails
- Model rankings are diagnostics, not guaranteed future performance.
- Small samples are labeled INSUFFICIENT.
- Positive EV does not guarantee profit.
- Edgeforce may recommend **NO BET**.
