# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V15

V15 replaces the single-provider placeholder with a normalized multi-provider ingestion layer.

### Added in V15
- Multiple authorized odds-provider slots
- Primary / secondary / tertiary odds failover
- Weather provider slots
- Injury provider slots
- Stats, results, and prediction-market provider slots
- Provider-specific auth-header and auth-scheme configuration
- Per-provider timeout and priority controls
- Generic normalized market model
- Support for flat Edgeforce-style feeds
- Support for common event/bookmaker/market/outcome payloads
- Provider latency/error health tracking
- Failover event logging
- Stored-market fallback
- Demo fallback only when no live or stored data is available
- Protected provider-ingest endpoint
- Automated database migration runner
- V15 provider-ingestion audit tables
- Updated health and smoke-test reporting

### V15 APIs
- `GET /api/markets` — live normalized feed with safe fallback
- `POST /api/provider-ingest` — protected ingestion run
- `GET /api/providers/health`
- `GET /api/providers/configured`
- `GET /api/deployment/smoke`

### Provider order
Edgeforce tries providers by priority. If the primary provider fails or times out, the next configured provider is tried. Each attempt records latency and error state when a database is configured.

### Market normalization
All upstream provider payloads are transformed into the same internal `Market` shape before they reach simulation, Kelly, portfolio, or parlay logic. This keeps model code independent of any one vendor.

### Safe fallback order
1. Authorized live provider
2. Latest stored normalized market snapshots
3. Local demo data

### Database migrations
Run:
```bash
npm run migrate
```

The migration runner applies unapplied `db/v*.sql` files in numeric order and records them in `schema_migrations`.

### Production data note
No sportsbook credentials are committed. Live production behavior requires licensed or otherwise authorized provider endpoints and credentials supplied through environment variables.

## Remaining major builds
- V16 — end-to-end tests, observability, performance/load testing, security hardening
- V17 — release candidate, preview promotion/rollback automation, final production QA

## Guardrails
- Low-quality or stale data can still be suppressed by the V14 quality gate.
- Provider failover does not override data-quality rules.
- Positive EV does not guarantee profit.
- The 30% daily gain display remains a target, not a promise.
- Edgeforce may recommend **NO BET**.
