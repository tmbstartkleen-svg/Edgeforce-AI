# Build 359: Offline import planning, not live migration

Command: `node scripts/d1-plan-offline-import.mjs ./private/source-jsonl ./private/empty-output`

Requires all ten input table JSONL files. Generates a source manifest, ten SQL files, and an offline plan. No SQL is executed. Refuses missing or empty input tables; zero-row legitimate tables require a future explicit signed-off flow. A failed run may leave partial files in the output directory; discard them and retry with a **new empty directory**, never apply them.

**Not a migration gate:** PostgreSQL exports from Build 357 use independent per-table snapshots, so this workflow does not prove multi-table consistency or fresh-source parity. Decimal precision, canonical PostgreSQL-to-SQLite types, >10k rows, imports executed against D1, cross-table foreign keys, application cutover, Neon replication, backups and real rollback all remain outstanding. Do not apply to production or enable D1-primary based on this plan.
