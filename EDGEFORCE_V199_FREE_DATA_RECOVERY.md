# EdgeForce V199 — Free Data Coverage Recovery

## Diagnosis

A screen that reads `1 accepted of 1 configured` does **not** show an outage of a second provider. It shows that only one odds feed was configured at request time. `TRUSTED` grades an individual payload; it is not a sportsbook-data depth certification.

EdgeForce already has a separate live-score mesh covering ESPN, NHL, MLB, and complementary score sources. That mesh is useful for game progress and results; **it cannot create actual sportsbook executable prices**. There is no verified public Google Sports API key that supplies unrestricted real sportsbook prices and player props.

V199 separately reports:
- Accepted odds *upstream providers*, which provide redundancy.
- Distinct actual *sportsbook bookmakers* within those accepted feeds.
- Markets with at least two distinct bookmaker prices. Several sportsbooks from one aggregator are not separately available upstream providers.

## Best free-first provider setup

1. **SportsGameOdds:** Existing `SPORTS_GAME_ODDS_API_KEY` adapter. Public Amateur plan advertises 2,500 objects per month, 8 leagues, 9 bookmakers, 10 RPM, with a card required at signup. `SPORTS_GAME_ODDS_FREE_MODE=true` limits the adapter to 10 events, one page, and an in-memory refresh interval of at least 6 hours. Stale prices remain non-tradable.
2. **The Odds API** at **the-odds-api.com**, not the similarly named provider at `theoddsapi.com`. Existing `THE_ODDS_API_KEY` adapter. Free plan advertises 500 credits/month. `THE_ODDS_API_FREE_MODE=true` uses only H2H, no costly prop/event expansion, and a minimum 3-hour refresh interval. Stale prices remain research-only.
3. **ESPN/TheSportsDB/MLB/NHL and other live-score feeds:** already implemented. Do not add them as sportsbook market-book providers or treat them as independent book quotes.

## Configuration (Cloudflare Worker)

In Cloudflare **Workers & Pages > edgeforce-ai > Settings > Variables and Secrets**, add keys as encrypted secrets, and free-mode flags as variables:

```dotenv
# Secret: use the key from the vendor account. Never paste the actual key in chat, GitHub, or .env.example.
SPORTS_GAME_ODDS_API_KEY=<vendor-issued-secret>
# Nonsecret
SPORTS_GAME_ODDS_FREE_MODE=true

# Secret: independent API, from https://the-odds-api.com/
THE_ODDS_API_KEY=<vendor-issued-secret>
# Nonsecret
THE_ODDS_API_FREE_MODE=true
```

Add only credentials you actually obtained and have rights to use. Be careful with Cloudflare previews versus the production Worker environment. Keep Cloudflare primary and Vercel standby/manual-only.

After adding valid keys, restart or deploy the Worker as normally required for variable changes; inspect live-board **Inspect provider diagnostics**. The expected result is **more configured providers**; an accepted count rises only when upstream responses pass parsing and quality. The provider count may remain less than two while free-mode cached quotes are too stale.

## Limits

The free tiers do not give subsecond, unlimited, all-sports, all-props pricing. The 3-hour/6-hour defaults are deliberately non-actionable for short-latency execution and may be rejected as stale by EdgeForce's stricter quote rules. Worker instances have independent in-memory caches; conservative per-instance TTLs are **not a hard globally coordinated quota governor**. Use the existing provider credit reserve, shared quota telemetry and health/circuit-breakers; a durable global source budget would be required to promise precise spending limits.

Do not alter `providerDegraded` to false merely to eliminate a warning. If one venue or one upstream is unavailable, mark the board as research-only. Proper entry signals require independent market evidence, recent executable quotes and calibrated model uncertainty.

## Current implementation

V199 improves zero-key setup diagnostics, actual bookmaker/upstream separation, vetted sportsbook key defaults, free-quota opt-in caps and tests. It **does not create or install a vendor API key**, solve all live latency, automatically bill vendors, or silently change production secrets.

Vendor documentation: https://sportsgameodds.com/pricing , https://the-odds-api.com/ , https://www.thesportsdb.com/documentation .