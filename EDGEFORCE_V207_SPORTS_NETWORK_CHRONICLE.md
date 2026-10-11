# EdgeForce V207: Sports Network intelligence, Past / Present / Future

## Product architecture

The **EdgeForce Sports Network** is a first-party data, analytics and forecasting platform. External, authorized sportsbook, scores, stats, injuries and league feeds supply observations, but EdgeForce owns the identity mapping, normalized storage, cache, quality gates, calibration tests and AI explanation layer. A model is NEVER a bookmaker and cannot supply missing live prices, official team results or player GPS/video data.

V207 adds a new professional **Sports Network** sidebar workspace with separate Past (90 days), Present (near-term games / latest observations), and Future (next seven days) tabs. Its private API is `GET /api/network/v1/intelligence?era=past|present|future&sport=NFL`. The sport filter is optional; omit it to review all sports actually represented in the database. Each call is bounded to 50 visible entries. Calls require owner authentication and do not poll any upstream API, invoke an LLM, create a wager or increase sports API quota spend.

## Past: source-defined historical research

Reads historic event identities and the most recent stored sportsbook market snapshot for events within 90 days, plus a yes/no flag when the internal ledger has a separately settled bet reference. **A bet settlement is not automatically an official game score.** If an official final score was never ingested, the game outcome remains NOT_VERIFIED. This is not a comprehensive historical score database and should not be called one.

## Present: time-stamped market observations

Reads stored events between six hours ago and 36 hours ahead and, where present, each event's latest stored bookmaker observation pulled within 30 minutes. Checks the source timestamp and receipt timestamp; records under two minutes old are called RECENT_OBSERVATION, older ones STALE_OBSERVATION, and those without trustworthy timestamps NO_VERIFIED_QUOTE. Every quote is explicitly **not executable**, and score verification remains separate.

## Future: actual model forecasts with uncertainty

Reads saved, timestamped EdgeForce `model_runs` attached to the next seven days of events. It can display a model probability and recorded Monte Carlo interval, not a factual future outcome. Forecasts with missing or contradictory intervals are INVALID_MODEL. Old models are STALE_MODEL. Recent models lacking recent, sample-backed historical calibration are UNCALIBRATED. RESEARCH_SUPPORTED requires valid recorded model runs and a matching chronological `calibration_metrics` profile with at least 200 observations, calibration error at most 0.08, Brier score at most 0.24 and period end within 365 days. Even RESEARCH_SUPPORTED **does not approve a bet**: no live executable sportsbook quote, independent source consensus, joint parlay calibration, or legal venue access is established. Monte Carlo sampling intervals do not capture structural model error.

## Secure owner setup and Cloudflare deployment

The V205 first-party API and V207 Chronicle use the SAME `EDGEFORCE_NETWORK_TOKEN_SHA256` hashed private bearer credential. Generate it locally and retain the raw token in a password manager, never a repository, screenshot or chat:

```bash
umask 077
openssl rand -hex 32 > edgeforce-network-token.secret
tr -d '\n' < edgeforce-network-token.secret | shasum -a 256
```

Add **only the 64-character resulting SHA256 hex digest** to GitHub repository **Settings → Secrets and variables → Actions → Secrets** with the name `EDGEFORCE_NETWORK_TOKEN_SHA256`. V207 adds this optional setting to the atomic Cloudflare production secret-delivery allowlist. Ensure the complete V205 → V206 → V207 release chain has merged and passed verified deployment gates before expecting it to reach production. Without this setting, authentication fails closed. The corresponding raw 64-character private token is entered only into the Sports Network workspace for a manual query; it is never saved to browser localStorage.

For the SharpAPI feed, configure separate issued `SHARP_API_KEY` in GitHub Actions secrets and `SHARP_API_ENABLED=true` in GitHub Actions variables if approved under the vendor's terms. Sharp is delayed pregame data, **not** a substitute for live/executable market confirmation. Sharp/ESPN/bookmaker coverage is reported separately from our owned first-party API key. The network key does not solve the `1 accepted of 1 configured` real upstream warning.

## Next milestones toward the exhaustive sports knowledge base

- **Licensed past outcomes and play-by-play:** append-only game score, player-stat and event feeds with exact source timestamp, canonical league/team/athlete IDs, attribution, legal retention and deduplication; do not backfill imaginary history.
- **Present reconciliation:** near-real-time score authority, injury/lineup revisions, timestamps, bounded request fanout, cross-provider disagreements and freshness SLA.
- **Future research:** rolling out-of-time validation, sport/league calibration, lineup uncertainty, schedule/weather context, Monte Carlo joint outcome correlation and defensible risk-managed EV.
- **Quality observability:** show actual per-league completeness, collection lag, provider health, last successful observation and unlicensed/unconfigured gaps. Real feeds remain necessary.

All current network routes are private research tools. The present scope is a first-party analytics foundation, **not** proof that all sports, seasons, player props, sportsbook prices, official scores, or future outcomes are available. Cloudflare remains the primary runtime and Vercel manual standby is unchanged. No automatically paid data contracts or subscriptions are created.