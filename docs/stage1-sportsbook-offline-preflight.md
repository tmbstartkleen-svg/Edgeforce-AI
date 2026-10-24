# Stage 1 sportsbook source preflight (offline and read-only)

Use this command with a **locally saved response you are authorized to inspect** from The Odds API v4. It reads the JSON array from disk and emits a bounded evidence report. It makes no HTTP requests, uses no API key and performs no D1 writes:

```sh
npm run odds:preflight -- /absolute/path/to/authorized-odds-response.json
npm run odds:preflight -- /absolute/path/to/authorized-odds-response.json --props
```

Requirements: install the repository's development dependencies and use a Node version supported by the project. The source file must be regular JSON no larger than 1 MB. `--props` is optional and allows provisional, name-based player prop **dry-run mapping**. This is not production authorization or a valid substitute for provider-native athlete IDs.

The report identifies observed bookmaker coverage, sports and leagues, market types not mapped, duplicate market-outcome identities, freshness failures, provisional player name IDs and blocked certification gates. A report with quote rows does **not** certify provider provenance, sportsbook entitlement, complete market coverage, independent upstreams, model calibration or successful D1 ingestion.

Exit code 0 means the input was readable and at least one valid target-bookmaker quote was prepared, **not** that release certification passed. Exit 2 indicates invalid arguments/input. Exit 3 indicates zero valid target bookmaker quotes.

Next Stage 1 acceptance evidence: authenticated provider response, approved archival/usage rights, source registration and owner-gated D1 ingestion, fresh persisted quotes, and independent readback/corroboration. Do not enable production writes or treat sports scores as sportsbook pricing.

## Explicitly authorized live connectivity probe

A separate CLI performs **exactly one** The Odds API request for U.S. DraftKings head-to-head odds and returns aggregate quality indicators. It does not save raw odds, show credentials, register a D1 source, or write observations. The request may consume provider API credits. Review your provider subscription and terms before choosing to execute it.

With `THE_ODDS_API_KEY` already configured in your local shell (do not paste or commit the value), execute:

```sh
npm run odds:probe-live -- --ack-provider-charge
```

The acknowledgement is mandatory. This is a live network request **only when the owner explicitly runs the command**; no background collection is scheduled. Successful output can demonstrate an authenticated API response and prepared sample quote counts, not player props or a complete slate. Neither a successful probe nor a stored production Worker secret proves D1 ingestion, sportsbook licensing permission or independent upstream corroboration.

## macOS Keychain convenience

After saving the provider key as a macOS generic-password entry for your account, service `edgeforce-the-odds-api`, run:

```sh
npm run odds:probe-keychain -- --ack-provider-charge
```

The wrapper retrieves the secret directly from macOS Keychain and passes it only to the local probe process environment. It does not print it, add it to source control or persist it in a dotenv file. The opt-in command can consume provider credits and runs only one request; there is no automatic polling. The Keychain item must already exist; missing credentials fail closed with no provider request.

## Major C large-build acceptance gate

Stage 1 now has a single, pure decision function `evaluateOddsStage1Acceptance` in `src/lib/odds-stage1-acceptance.ts`. It requires all of the following before Stage 1 acceptance can be *considered*:

1. An authenticated, fresh (15-minute) upstream request returning priced sportsbook outcomes.
2. Independently documented provider permission to store and reuse odds, with accountable authorizer, scope and future expiry.
3. A source-matched isolated D1 quote readback with no missing, modified, duplicated or capped rows.
4. At least two **independent upstream providers**, with actual matching price observations (not two bookmaker names from one feed).
5. An authorized expected-market catalog and measured coverage against that catalog.

The decision function performs no I/O, is included in CI, and **never** returns production release certification. The supplied evidence must be acquired and audited separately; typing in a `confirmed:true` flag does not create legal entitlement or genuine source evidence.

Owner / external prerequisites to close Stage 1: obtain documented storage terms, arrange a second independently owned authorized feed, explicitly approve a limited D1 pilot write session, and reconcile fresh permissioned prices against persisted rows. The October 23 authenticated sample of 19 prices is historical evidence and naturally becomes stale, so it cannot be replayed as live certification. Preserve pilot write-disabled settings until these prerequisites are proven.
