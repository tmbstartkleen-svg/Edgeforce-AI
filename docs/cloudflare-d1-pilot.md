# EdgeForce Cloudflare D1 pilot (zero-destructive migration)

Neon is currently suspended because its monthly outbound network transfer allowance was exhausted. D1 uses SQLite, **not PostgreSQL**. This pilot does not migrate existing Neon records, activate ingestion, or replace PostgreSQL routes.

## Create a D1 database in the SAME Cloudflare account as edgeforce-ai

```bash
npx wrangler d1 create edgeforce-intelligence
```

Save the printed database_id. Add the binding to `wrangler.jsonc` **only after the actual ID exists**:

```json
"d1_databases": [{
  "binding": "INTELLIGENCE_DB",
  "database_name": "edgeforce-intelligence",
  "database_id": "<actual database_id>"
}]
```

Initialize the new D1 database (no changes to Neon):

```bash
npx wrangler d1 execute edgeforce-intelligence --remote --file=db/d1/0001_intelligence_pilot.sql
```

**WARNING:** Production `vinext` creates `dist/server/wrangler.json`; verify that it retains the D1 binding before deploying. Do not remove the existing Postgres environment/secrets or change `npm run migrate` as part of this pilot. A production deployment cannot complete while the existing mandatory Neon migration runs against its suspended compute. Deploying D1 requires a separately reviewed deployment gate or a non-production Worker preview.

## Read-only D1 evidence endpoint
`GET /api/operations/d1-pilot/readiness` requires `Authorization: Bearer <CRON_SECRET>`. It reports whether a D1 binding and both tables are accessible. It never reveals secrets, reads existing sports history, or writes to the database. A healthy D1 pilot is **not** evidence that EdgeForce fully migrated.

## Subsequent steps
1. Validate D1 remote schema and binding in preview.
2. Add bounded D1 write and read adapters behind explicitly disabled rollout flags; preserve original upstream timestamps and source identities.
3. Audit the actual PostgreSQL query callsites and move hot/short-lived data routes to D1 incrementally.
4. Export and verify Neon history **after quota resets or access is restored**, then import only needed historical records.
5. Certify live writes, reads, refresh times, cost limits, and rollback before changing production storage or skipping migrations.
