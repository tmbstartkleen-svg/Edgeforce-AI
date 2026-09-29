# Edgeforce AI deployment

## Recommended workflow

Edgeforce uses a verify -> preview -> smoke test -> promote workflow.

### One-time Vercel setup
1. Import the GitHub repository `tmbstartkleen-svg/Edgeforce-AI` into the Vercel team.
2. Framework preset: Next.js.
3. Root directory: repository root.
4. Add required environment variables from `.env.example`.
5. Apply database migrations through `db/v14.sql`.
6. Keep Git integration enabled so branch/PR pushes create preview deployments automatically.

### Required production environment variables
- DATABASE_URL
- ODDS_API_URL
- ODDS_API_KEY
- WEATHER_API_URL
- WEATHER_API_KEY
- INJURY_FEED_URL
- INJURY_FEED_KEY
- INGEST_SECRET
- CRON_SECRET
- MODEL_VERSION=edgeforce-v14
- DEFAULT_BANKROLL

### Verification gates
Before production promotion:
1. GitHub `Verify Edgeforce` workflow must pass.
2. Preview deployment must be READY.
3. `GET /api/health` returns `ok: true`.
4. `GET /api/deployment/smoke` returns `smoke: true`.
5. Dashboard renders without runtime errors.
6. Critical API routes return expected demo/fallback behavior if optional provider keys are not configured.
7. Review Vercel runtime errors before promotion.

### Production promotion
Promote the exact preview deployment that passed smoke tests. Do not rebuild a different artifact just for production.
