# Build 360: consistent baseline snapshot
Use an authorized least-privilege read-only credential: `EDGEFORCE_MIGRATION_SOURCE_URL=... node scripts/d1-pg-consistent-export.mjs ./private/empty-directory`.

All ten baseline tables are read inside **one PostgreSQL repeatable-read read-only transaction**, addressing the inconsistent per-table snapshot issue. Each table is capped at 10,000 rows. A failure removes staged JSONL files. Export files contain potentially confidential sports/provider data: secure and never commit them.

This does not guarantee precision-safe PostgreSQL-to-D1 conversion, historical migration-table completeness, backfill, replay of changes written after the snapshot, actual D1 import, Neon synchronization, credential access if compute quota is exhausted, or production cutover. A successful export is insufficient to permit launch. Large tables require a separately certified streamed/paginated snapshot strategy.
