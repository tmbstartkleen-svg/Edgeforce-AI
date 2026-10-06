# Edgeforce V109 — Legacy Production Upgrade

V109 repairs the next authenticated production failures exposed by V108.

## Verified V108 production findings

- Cloudflare credentials, build, Worker validation, base-schema bootstrap, and migrations v6 through v39 all succeed.
- v40 fails because v21 previously created `prediction_market_snapshots` with an older `provider/pulled_at` schema, so `CREATE TABLE IF NOT EXISTS` in v40 does not add `venue/observed_hour`.
- Vercel credentials, project resolution, pull, and protected requests all succeed.
- The live Vercel production runtime is version 23.0.0, which predates the V74 SLO governor; the workflow currently allows the bounded bootstrap path only for V73.

## V109 repair contract

### Legacy prediction-market schema upgrade
- preserve the existing v21 table
- add v40 columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- backfill `venue` from legacy `provider`
- backfill `observed_hour` from legacy `pulled_at`
- enforce required non-null columns after backfill
- add the v40 uniqueness contract after compatibility upgrade

### Bounded pre-V74 production bootstrap
- parse the deployed production major version
- allow the one-time bootstrap path for any numeric release older than V74
- prefer production observability when the legacy endpoint exists
- otherwise require legacy readiness to report healthy
- continue to fail closed for V74+ runtimes without the SLO governor

## Identity

- build: V109
- app: 109.0.0
- package: 0.109.0
- model: edgeforce-v109
- migration: v114 (unchanged)
