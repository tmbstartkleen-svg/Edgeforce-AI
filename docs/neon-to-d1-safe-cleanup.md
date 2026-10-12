# EdgeForce storage and repository cleanup inventory

## Current decision
D1 is the future Cloudflare-native operational store. **Postgres/Neon is not yet safe to remove.** The existing application still imports `postgres` in `src/lib/db.ts`, builds runtime secret bundles requiring `DATABASE_URL`, and performs Postgres migrations with `scripts/migrate.mjs`. Many application routes expect existing SQL semantics. The isolated D1 pilot is deployed separately and does not replace those paths.

## Safe cleanup in this change
- Turn off the GitHub Actions `workflow_run` automatic production Cloudflare deploy for every main verification result.
- Turn off the GitHub Actions `workflow_run` automatic Render ML deployment trigger.
- Preserve both `workflow_dispatch` manual recovery paths.
- Do not delete or change historical data, Postgres connection code, schema, migrations, lockfile, runtime secrets, production bindings or the deployed EdgeForce Worker.
- Keep D1 provisioning and isolated D1 deployment independent and operational.

Cloudflare dashboard's **separate Git-connected build integration** is configured in Cloudflare, not GitHub Actions. Disable that integration in Cloudflare UI separately; GitHub workflow changes do not alter its `npm run build`/`npx wrangler preview` settings.

## Required before deleting Neon from the app
1. Inventory all `db()` consumers, SQL queries, transaction semantics, joins, analytics tables, and historical snapshots.
2. Obtain a verified read-only export of Neon after quota/access is restored. Capture per-table counts, export hashes, schema versions and a recoverable offline copy. Do **not** delete the Neon project first.
3. Design corresponding D1 schema and migrations for all required relational records; assign R2 or approved archival storage for historical bulk payloads with retention and cost controls.
4. Implement D1 repository adapters and dual-read parity tests for affected routes; fix Postgres-specific SQL and transaction behavior.
5. Backfill and reconcile source keys, old observations, historical simulation data and non-sports contracts. Certify row counts, checksums, timestamp fidelity and sample queries.
6. Run hosted load tests under Cloudflare limits, verify all workflows and customer-facing endpoints.
7. Only after complete verified cutover remove `postgres` dependency, Postgres migrations, `DATABASE_URL` production secrets, stale Neon env variables and obsolete scripts in a dedicated PR.

Production Cloudflare deployment currently remains blocked by the Neon migration gate; this PR deliberately leaves that gate in place so manual deployment cannot accidentally ship an incomplete database migration.
