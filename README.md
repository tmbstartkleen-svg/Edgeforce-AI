# Edgeforce AI

Context-fused sports probability intelligence workspace.

## Current build — V23 Context Fusion + Event-State Simulation

V23 connects configured weather, injury, and stats providers directly into the live market rows before ranking and simulation.

### V23 upgrades
- provider-backed weather, injury, and stats context fusion
- event matching by provider event ID, event name, or home/away team pair
- normalized feature maps feeding the existing sport-specific engines
- explicit context-source tracking on market rows
- context-source metadata retained in model-run feature snapshots
- dashboard shows enriched-row count and active context-provider count
- strict stored-market query now excludes already-started events
- V22 learned historical model weighting remains active
- V22 scenario-volatility simulation now receives real provider context when configured
- context source and sport-feature JSON indexes added for audit queries

### Context providers
Configure supported endpoints using:
- `WEATHER_PROVIDER_PRIMARY_URL` / `WEATHER_PROVIDER_PRIMARY_KEY`
- `INJURY_PROVIDER_PRIMARY_URL` / `INJURY_PROVIDER_PRIMARY_KEY`
- `STATS_PROVIDER_PRIMARY_URL` / `STATS_PROVIDER_PRIMARY_KEY`

Secondary weather and injury providers are supported by the existing failover layer.

Provider payloads can expose normalized feature values either in a `features` object or as top-level feature keys. Values are bounded to the -1 to +1 feature scale used by the sport models.

### Core APIs
- `GET /api/live-board?view=today&limit=30&risk=Moderate`
- `GET /api/live-board?view=week&limit=50&risk=Moderate`
- `GET /api/intelligence/learned-weights`
- `GET /api/intelligence/model-performance`
- `POST /api/portfolio/optimize`
- `GET /api/health`

### Database
Apply migrations through `db/v23.sql`.

V23 adds GIN indexes for context-source and sport-feature metadata stored in model-run feature snapshots.

### Data truth rules
- The app does not scrape DraftKings directly.
- Live data comes only from configured authorized providers.
- Stored rows are limited to events from now through eight days out.
- If odds providers are unavailable, the UI identifies stored or demo fallback mode explicitly.
- Context diagnostics show whether weather/injury/stats data actually matched current market rows.

### Guardrails
- Simulation and model probabilities are estimates, not certainties.
- Missing provider context is not silently invented.
- Learned weights ignore undersized historical groups and remain bounded.
- Context features are normalized and capped before they affect sport models.
- Correlated exposures remain limited by the portfolio optimizer.
