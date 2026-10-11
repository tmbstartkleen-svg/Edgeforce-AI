# Intelligence Core — Multi-Sport Collector Extension

## Collection lanes
- Live games / scores: use existing permitted score provider adapters; preserve source event ID, source-side observed timestamp and provider ID.
- Injuries: preserve athlete identity, team, report status, report observation time, and immutable provider identity; do not substitute collection time for report time.
- Player stats: use verified player-to-team, event and stat identity mappings; quarantine unresolvable athletes.
- Prediction markets: preserve contract ID, venue and upstream adapter ID; never count two order books in one aggregator as two independent providers.

## Activation requirements
Before connecting each collector to the warehouse:
1. Register its explicit independent upstream in intelligence_sources with an approved license reference.
2. Ensure source timestamps are available and true to source (no fabricated observation times).
3. Add bounded, best-effort writes and per-provider budgets.
4. Verify the adapter in CI, then in a no-production-impact preview.
5. Roll out one collector at a time; preserve existing production cron ownership.

## Governance
The Intelligence Core is the first-party source of historical analytics, not a first-party origin of independently verified live scores or sportsbook quotes. Missing quotes remain missing. Predictions must remain tagged forecasts. Continuous polling is provider-entitlement dependent. Existing Cloudflare cron schedules must not be duplicated.
