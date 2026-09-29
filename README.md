# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V16

V16 is the hardening and verification build.

### Added in V16
- Next.js 16 `proxy.ts` security layer
- API rate limiting
- Security headers
- Per-request Edgeforce request IDs
- Structured JSON observability helper
- Runtime diagnostics endpoint
- Provider-failure simulation endpoint for CI/testing
- Production-server smoke test script
- Lightweight concurrency/load check
- GitHub Actions production build + start + smoke + load pipeline
- Runtime incident, performance sample, and recovery-test database tables

### CI release gate
Every push to `main` now:
1. installs dependencies
2. runs the optimized production build
3. starts `next start`
4. waits for `/api/health`
5. verifies health, deployment smoke, diagnostics, dashboard rendering, and security headers
6. runs a provider-failure simulation
7. sends concurrent requests to the production server
8. fails the workflow if any required check fails

### V16 APIs
- `GET /api/diagnostics`
- `GET /api/testing/provider-failure` when `ENABLE_TEST_ENDPOINTS=true`
- existing `/api/health` and `/api/deployment/smoke` now report V16 hardening state

### Security controls
Responses receive:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy
- Permissions-Policy
- Cross-Origin-Opener-Policy
- Cross-Origin-Resource-Policy
- request correlation ID

The in-memory rate limiter is a per-instance protection layer. A shared distributed limiter should be added later if deployment volume requires cross-instance enforcement.

### Database
Apply migrations through:
```
db/v16.sql
```

### Remaining major build
- V17 — release candidate: Vercel project validation, preview smoke test, migration gate, promotion/rollback workflow, final production QA

## Guardrails
- Production test endpoints are disabled unless explicitly enabled.
- No provider credentials are committed.
- Low-quality or stale market data can be suppressed.
- Positive EV does not guarantee profit.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
