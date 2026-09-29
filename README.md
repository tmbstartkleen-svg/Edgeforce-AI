# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V18 Post-Release Operations

V18 extends the V17 release candidate with a live operations layer.

### Added in V18
- deployment/runtime status API
- release history API
- runtime incident API
- 24-hour route performance API
- live ops strip in the main dashboard
- uptime-check persistence
- deployment-observation persistence
- V18 migration gate

### V18 APIs
- `GET /api/ops/status`
- `GET /api/ops/releases`
- `GET /api/ops/incidents`
- `GET /api/ops/performance`

### Live operations strip
The dashboard now shows:
- Vercel/local deployment state
- database health
- configured provider count
- process uptime
- current app version
- monitoring status

### Deployment state
When Edgeforce is hosted on Vercel, the ops layer reads Vercel runtime environment metadata directly from the deployment. Until the project is imported and deployed, it clearly reports `LOCAL / UNLINKED`.

### Database
Apply migrations through:
```
db/v18.sql
```

### Release pipeline
All V17 build, migration, smoke, load, promotion, and rollback safeguards remain active.

## Guardrails
- Monitoring status does not imply wagering outcomes.
- Positive EV does not guarantee profit.
- Low-quality market inputs can still be suppressed.
- Portfolio and drawdown limits remain active.
- Edgeforce may recommend **NO BET**.
