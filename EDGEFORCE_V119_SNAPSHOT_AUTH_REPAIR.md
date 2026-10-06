# V119 snapshot persistence and atomic Cloudflare credential delivery

Base: 8f3c9f75310cfcd776ae962c2a20f92e59635273 (PR #153).
Identity remains V119 / 119.0.0 / edgeforce-v119 / migration v114.

## Repairs

- The prediction contract writer detects the known optional legacy snapshot columns
  `provider` and `no_probability` once per batch, writes the actual contract values
  when those columns exist, and keeps both probabilities in the raw contract on
  modern schemas. No migration, constraint removal, invented probability, or
  historical snapshot rewrite is required.
- State upsert and hourly snapshot insert share one transaction per contract.
  Invalid identity/probabilities reject the selected batch before writes, and a
  database snapshot failure rolls back that contract's state update. Earlier
  committed contracts remain committed; this is not a whole-batch transaction.
- Cloudflare production code and required/optional configured secrets deploy in
  one Wrangler operation using `--secrets-file`. This replaces the separate
  predeploy bulk secret upload and postdeploy optional-secret update. The private
  file has mode 0600, refuses existing files/symlinks, contains only allowlisted
  keys, and is removed by an always-run cleanup step. Secret values are not logged.
- A non-cancelling production concurrency group prevents overlapping credential
  rotations. A current-main check blocks already-superseded source commits before
  migrations or deployment; manual production dispatch is restricted to main.

## Verification

18 focused synthetic tests passed in the working container. They exercise actual
transpiled writer code, modern/legacy column combinations, explicit No values,
invalid input rejection, transaction failures, idempotency, database isolation,
secret-file permissions/allowlisting, CLI redaction, and workflow wiring.

A dedicated loopback-only PostgreSQL fixture step is added to Verify Edgeforce.
It must pass in CI alongside existing lint, typecheck, build, migration, audit,
smoke and load checks before merge. The fixture database is separate from app
credentials and refuses remote or non-fixture database targets.

## Remaining limits

The Cloudflare 401 cause is not conclusively proven by code inspection; the next
hosted run must demonstrate that credential delivery and authentication work.
No authentication or release gate is bypassed, and no production success is
claimed from synthetic tests. The original SLO, canary and V1 promotion gates
remain unchanged.

This repair does not restore exhausted full sportsbook odds, configure a results
provider, settle bets without matching outcome evidence, clear ACTION incidents,
reset SLO history, or close issue #151. Vercel promotion remains blocked until
those independent operational requirements genuinely recover.
