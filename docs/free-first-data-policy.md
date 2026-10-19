# EdgeForce free-first data and research policy

## Primary source architecture
EdgeForce operates from its own D1 data warehouse, independently computed sports models, evidence ledger, simulation infrastructure, and scheduled research jobs. Public ESPN feeds are the preferred free source for supported fixtures, results, team/player statistics, and DraftKings-labelled quotes when explicitly supplied. Public fixture/score data must **never** be represented as sportsbook odds.

## Optional supplemental providers
Use public permitted resources, respecting request limits and source terms, for official injuries, lineup news, weather, TheSportsDB, soccer/tennis coverage, and other research signals. Public Polymarket quotes are exchange prices, not independently estimated win probabilities. Paid or authenticated feeds are optional enrichments, not prerequisites for core schedules, modeling, calibration, and research.

Kalshi market polling is disabled in the free-first production configuration until upstream rate limiting is resolved. The diagnostic endpoint remains protected; the absence of new Kalshi quotes must not be hidden.

## Agent team responsibilities
- **Director**: orchestrates refresh cadence, ownership, budgets and audit trail; prevents simultaneous redundant scraping.
- **Coverage**: tracks all sports, leagues and props requested by users; reports *coverage gaps* separately from zero games.
- **Score/fixtures**: collects events with provider identity, timestamps, freshness, and deduplication.
- **Injuries/lineups/weather**: maintains sourced evidence and explicit uncertainty.
- **Odds**: accepts only actual time-stamped, venue-attributed betting quotes. Missing or stale price => no bet signal.
- **Quant/simulation**: estimates independent probabilities and uncertainty; records model version, inputs and run metadata; never claims simulations that were not executed.
- **Value auditor**: computes break-even probability, estimated edge in percentage points, expected ROI and realistic market costs; disallows unsupported cross-market equivalence.
- **Results/calibration**: reconciles settlements and closing lines, tracks Brier/log loss and calibration by market.
- **Reliability**: respects free quotas, caches quotes with age, uses circuit breakers and displays degraded source coverage honestly.

## Signal release rules
A value bet may be labelled verified only if (1) selection/line/settlement rules match; (2) a fresh, attributable executable quote exists; (3) probability is independently modeled with evidence; (4) calculated edge is positive after relevant costs; (5) data freshness and missingness are displayed. Without an actual quote, show research-only predictions and no invented DraftKings lines.

## Deployment rules
Keep the Cloudflare D1 primary path. Do not enable paid providers by default or publish secret keys. GitHub CI must pass before merging production changes; verify Cloudflare rollout and public smoke checks after deployment.
