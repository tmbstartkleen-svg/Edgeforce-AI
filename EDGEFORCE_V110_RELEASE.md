# Edgeforce V110 — Legacy Schema + Readiness Bridge

V110 repairs the next two production boundaries exposed by V109 after the original v40 migration blocker was cleared.

## Verified V109 production findings

- main verification passed.
- Cloudflare build and Worker validation passed.
- the V109 prediction-market repair worked: migration now completes v40 instead of failing on the missing `venue` column.
- migration then fails at v41 because the legacy `athletes` table predates `normalized_name`.
- Vercel reaches the pre-V74 bootstrap branch for live production `23.0.0`.
- the old production observability endpoint is not valid JSON, so the bootstrap cannot rely on V74-era observability APIs.

## V110 repair contract

### Legacy athlete schema reconciliation

Before versioned migration replay, the migration runner now upgrades an existing legacy `athletes` table to the V41 contract:

- adds source/name/normalized-name/team fields
- backfills canonical names from legacy `full_name`
- carries forward team metadata
- restores first/last-seen timestamps
- resolves duplicate normalized identities deterministically without dropping rows
- creates the canonical sport + normalized-name uniqueness contract

### Legacy player-stat schema reconciliation

The existing `player_game_stats` table is also upgraded before v41:

- adds opponent, home/away, team, minutes, usage, raw payload and ingestion timestamp
- converts legacy date-only timestamps to `timestamptz`
- backfills missing source and ingestion metadata
- replaces the old two-column uniqueness rule with the V41 multi-source athlete/event/source key

### Layered pre-V74 production readiness

When live production predates the V74 SLO governor:

1. `/api/health` must return valid healthy JSON.
2. Edgeforce tries the newer observability endpoint when available.
3. if observability is unavailable, it tries `/api/health/ready`.
4. if both newer endpoints predate the live release, the already-validated health response becomes the explicit legacy bootstrap baseline.
5. V74+ releases still require the SLO-governor contract and continue to fail closed if it is unavailable.

Production baseline capture now also synthesizes bounded legacy observability/reliability/readiness defaults only when those newer endpoints do not exist, while still requiring valid healthy production health JSON.

## Regression evidence

- release audit verifies athlete-schema reconciliation
- release audit verifies player-stat multi-source reconciliation
- release audit verifies layered pre-V74 readiness
- health and smoke expose the V110 bridge capability

## Identity

- build: V110
- app: 110.0.0
- package: 0.110.0
- model: edgeforce-v110
- migration: v114 (unchanged)
