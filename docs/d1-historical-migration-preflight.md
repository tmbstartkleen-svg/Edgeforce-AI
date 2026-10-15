# D1 historical migration preflight (Build 354)

This is **offline** validation tooling, not a historical data migration and not permission to promote D1. It never connects to either database, changes a record or accesses secrets.

Generate independent source PostgreSQL and target D1 manifests from approved, *consistent snapshots*. Each JSON manifest has schemaVersion 1 and a tables object for all ten baseline tables. For each table supply a nonnegative integer count and a 64-character SHA-256 digest of the **same canonical row representation and deterministic row order** on both systems. Correctly normalize UTC timestamps, decimal precision, JSON key ordering, NULL and booleans, and large integers before computing the digest. A matching digest of untrusted, non-snapshot data is not proof of database correctness. Don't include credentials, PII, or raw rows in manifests.

Example: `node scripts/d1-migration-preflight.mjs ./private/source-manifest.json ./private/target-manifest.json`.

The checker reports count/content mismatches and blocks incomplete manifests. It does **not** generate manifests, backfill the target, validate historical Postgres migrations, handle pagination, ensure transactional snapshots, certify replication, guarantee rollback, or authorize runtime cutover. Those require separate design, implementation and production verification. The D1-primary gate must remain closed.
