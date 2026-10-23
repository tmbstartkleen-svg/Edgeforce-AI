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
