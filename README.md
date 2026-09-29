# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V14

V14 adds the production data-quality and deployment verification layer.

### Added in V14
- Data-quality scoring for every market
- Freshness scoring
- Completeness checks
- Cross-provider agreement checks
- Lineup / availability certainty input
- Duplicate observation penalty
- Quality grades: TRUSTED, USABLE, CAUTION, SUPPRESS
- Automatic suppression of poor-quality signals
- Provider health registry
- Provider capability/priority model
- Provider failover selection logic
- Provider health API
- Deployment smoke-test API
- GitHub build verification workflow
- V14 database migration for provider health, quality snapshots, and failover history

### V14 API
- `POST /api/data-quality`
- `GET /api/providers/health`
- `GET /api/deployment/smoke`

### Quality gate
A positive-EV market is not enough. Edgeforce can suppress a market when:
- source data is stale
- provider coverage is incomplete
- providers materially disagree
- lineup certainty is low
- duplicate feed observations are detected

### Deploy/test workflow
1. Push code to GitHub.
2. GitHub Actions runs `npm install` and `npm run build`.
3. Create a Vercel preview deployment.
4. Verify `/api/deployment/smoke`.
5. Verify the dashboard and critical APIs.
6. Review build/runtime errors.
7. Promote only the tested preview to production.

### Database migrations
Apply migrations through:
```
db/v14.sql
```

## Remaining major builds
After V14, roughly three major builds remain before production release:
- V15 — real provider adapters, failover, normalization, and database migration automation
- V16 — end-to-end tests, observability, performance/load checks, security hardening
- V17 — release pipeline, production environment validation, rollback/promotion workflow, final production QA

## Guardrails
- Data quality can override raw model attractiveness.
- Low-quality inputs are suppressed rather than presented as strong signals.
- Positive EV does not guarantee profit.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
- Production feeds should be licensed or otherwise authorized.
