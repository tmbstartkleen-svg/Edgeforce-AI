# Build 355: manual/offline D1 import batches

This tool **does not export Postgres data**, connect to D1, import to a database, or claim migration completeness. An operator must first obtain a consistent, authorized PostgreSQL snapshot and convert supported tables into JSONL without dropping IDs. Only teams, athletes, events, player_game_stats and weather_snapshots are supported initially; model and settlement tables need additional precision/foreign-key design before bulk import.

Usage: `node scripts/d1-offline-import.mjs teams ./private/teams.jsonl ./private/teams.sql`

Each JSONL line is a row with column names matching the D1 schema. Batches are capped at 10 MB and 10,000 rows and generated as transaction-wrapped SQL on disk with exclusive create permissions; the tool never runs that SQL. Back up databases, apply existing D1 schema migrations, review generated SQL, use a nonproduction D1 target first, and validate counts and normalized content digests afterward. A failed import is not license to switch traffic or delete Postgres/Neon data. Future work must address total D1 statement/transaction limits, all table families, reproducible snapshot extraction, canonical numeric/timestamp conversion, batch checkpoints and post-import reconciliation.
