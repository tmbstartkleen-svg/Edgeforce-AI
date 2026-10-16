# Build 357: bounded source extraction

Export one baseline table at a time: `EDGEFORCE_MIGRATION_SOURCE_URL=... node scripts/d1-pg-readonly-export.mjs teams ./private/teams.jsonl`.

The tool opens a **read-only repeatable-read transaction**, checks table row count (maximum 10,000), retrieves ordered rows, and writes a private JSONL output. It never changes source rows and never executes a D1 import. Requires a least-privileged PostgreSQL read-only credential; never commit database URLs or exports. If the Neon compute quota remains exceeded, do not bypass the provider limit; the export cannot run until the database is accessible.

**Important:** Table snapshots are independent, not a single consistent whole-database snapshot. The code does not paginate large tables, provide a canonical export for arbitrary precision decimal values, reconcile timestamps/JSON across engines, produce all ten tables as one transaction, automatically import to D1, or certify rollback/secondary replication. Tables over 10,000 rows deliberately fail rather than silently truncate. This is a first guarded export step, not a certified migration.
