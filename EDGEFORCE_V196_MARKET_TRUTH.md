# EdgeForce V196 — Market Truth and Price Integrity

V196 builds on the new V195 Institutional Edge Desk and PR #246 workspace redesign. It changes evidence qualification, not the deployment topology.

## What is now validated

- Provider-reported timestamps are retained by flat and sportsbook-structured odds normalization. Missing timestamps are not silently converted into independently verified observations.
- The local cross-book scanner excludes started events, invalid/unknown bookmaker identities, missing/future or aging quote timestamps, and quotes older than the configured maximum (10 minutes by default).
- Fair odds for a candidate are reconstructed **only from independent, complementary outcome sets** from other sportsbooks. The quoted book does not form its own reference. Consensus requires two complete other books; one independently complete sharp book can serve as a sharp reference.
- Point-spread selections are grouped using home-normalized **signed** lines so Home -3.5 and Away -3.5 cannot be treated as opposite sides.
- Cross-book arbitrage candidates require at least two distinct sportsbooks. The scanner still cannot guarantee simultaneous executable fills or compatible limits.
- Non-live, stored, unavailable and degraded provider panels are labeled SOURCE_UNVERIFIED and return no executable cross-book signals. The UI clears previous scanner results when the feed fails.
- The new Trade Desk loads the scanner on direct entry and shows the counts rejected for missing timestamps, staleness, and expired games.
- For sportsbooks, breakeven probability comes from the actual offered American odds, never from a no-vig consensus price. Exchange entries additionally require fee adjustment, matching contracts, and a timestamped execution quote.

## Model limitations

This is a high-integrity quote comparator, not proof of a statistically profitable strategy. A sharp-book no-vig line is a market reference, not an independently validated prediction model. The V195 model calibration and conservative confidence interval remain separate.

No automatic order execution, automatic staking, credential change, new provider request or premium-data claim is added. Cloudflare remains the production primary; Vercel remains manual disaster-recovery standby. Changes must pass review and CI before reaching production.

## Operational follow-up

Investigate connected feeds that do not expose provider-native timestamps. Those feeds should remain excluded from execution-qualified screens until source age can be evidenced. Monitor rejected quote counts, independent-book coverage, real closing-line value and settled model calibration before loosening thresholds.