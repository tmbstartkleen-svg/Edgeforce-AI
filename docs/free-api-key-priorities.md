# Free API key priorities — checked 2026-10-25

## Scope and evidence

Inventoried all 15 repositories visible under tmbstartkleen-svg. Examined Edgeforce-AI provider modules and selected trees, READMEs/configuration/source candidates in Claude_Sports_TMB, Grok_Sports, Gemini-Sports, Claude_Sports, Team and TravAI. This is a targeted integration audit, not an exhaustive line-by-line review of every repository. Related sports repositories did not establish additional authenticated premier feed access: Grok references ODDS_API_KEY; Claude sports material references ESPN and Hugging Face backtest data. A source name or variable is not a working credential.

Reviewed public repositories in sports-data-coverage-audit.md as supplemental data/client candidates. Do not harvest credentials from public code. Current privately saved keys are BetStack, PropLine and TheRundown; other credential availability has not been exhaustively checked across secret stores.

## Recommended order

| Priority | Key/account to verify or obtain | What it adds | Free-tier boundary | Existing implementation |
|---|---|---|---|---|
| 1 | API-Sports / API-Football | Multi-sport fixtures/stats; soccer lineups, transfers and injuries | 100 requests/day per API advertised; soccer free seasons restricted. Test current season entitlement before relying on injuries. | No dedicated provider found in EdgeForce provider directory |
| 2 | CFBD, then CBBD account access | College football/basketball historical and analytical context for models | Free key documented; exact current quota not verified. Shared quota across CFBD/CBBD; platform-specific key access must be confirmed. | No dedicated provider found in provider directory |
| 3 | SHARP_API_KEY | Independent DraftKings/FanDuel pregame odds check | 12 requests/minute, 2 books, 60-second delay. Not live cash-out pricing; avoid card-required paid trial. | sharpApi.ts; explicit opt-in |
| 4 | THE_ODDS_API_KEY | Broad independent bookmaker comparison and coverage check | 500 credits/month; markets/regions consume quota. Historical odds excluded. | theOddsApi.ts and config.ts |
| 5 | FOOTBALL_DATA_API_KEY | Soccer fixture/table verification | 12 competitions, 10 calls/minute; scores and schedules delayed. Free plan does not include premium squads/lineups or odds add-on. | communityScoreBackups.ts |

Keep using the supplied PropLine and TheRundown credentials for bounded validation before seeking more overlapping odds providers. PropLine's 71 categories are not 71 distinct sports; 11 returned no events in the audit. BetStack remains quarantined from trusted schedules after the filter mismatch.

## Lower priority or unsuitable free claims

- BALLDONTLIE: basic free access at 5 requests/minute; not a demonstrated solution to the injury gap. Its injury webhooks require All-Access and Lab API is paid. Verify endpoint entitlements before signup work.
- PandaScore: attractive free esports schedule/context quota (1,000/hour), but pricing explicitly limits listed statistics plans to non-betting use. Exclude from this betting dashboard unless provider authorizes this use.
- FieldFunded: advertised broad free coverage, but signup returned a network error and no key was confirmed. Candidate, not verified premier feed.
- Sportradar/OpticOdds: enterprise candidates, not established permanent free solutions. No paid access enabled.
- TheSportsDB/OpenF1: useful metadata or historical data; premium live functionality is not free.
- SportScore, nflverse, SportsDataverse, pybaseball, nba_api and Cricsheet can supplement context without purchasing API keys, subject to their data terms and operational constraints. Code-library licenses do not grant upstream data rights.

## What would make the data dependable

Prioritize independent fixture matching, actual source timestamps, injury/lineup confirmation, consistent team/event identifiers and measured missing-data rates. Track each sport by schedules, odds, injuries, rosters, history and validated simulation availability separately. Multiple feeds may share the same upstream source; agreement alone does not prove independent confirmation.

A simulation percentage needs calibrated, held-out model testing and explicit uncertainty. No API key by itself supplies a trustworthy EdgeForce Monte Carlo model. Current free quotas cannot be assumed to support every sport with live odds, injuries and cash-out timing continuously. Keep unavailable data visibly unavailable.

## Primary references

- https://api-sports.io/
- https://www.api-football.com/pricing
- https://api.collegefootballdata.com/getting-started
- https://api.collegefootballdata.com/usage-and-access
- https://collegefootballdata.com/terms
- https://sharpapi.io/pricing
- https://the-odds-api.com/ — use this exact provider domain; similarly named domains are different services.
- https://www.football-data.org/pricing
- https://www.balldontlie.io/account/
- https://www.balldontlie.io/webhooks
- https://lab.balldontlie.io/docs/api/
- https://www.pandascore.co/pricing

No accounts, subscriptions, paid trials, production switches or billing changes were made during this review.

## Credential validation update

Five additional user-supplied credentials were saved outside the repository with owner-only file permissions. No secret values are included here.

- API-Sports: all 12 product status endpoints returned HTTP 200, active Free, 100 requests/day/product. This proves subscription access, not current-season data availability. Football EPL fixtures and injuries with season=2026 returned HTTP 200 containing a plan error and zero results: free access restricted to 2022–2024. Treat API-level errors as failures even when HTTP status is 200. Do not use this plan for current soccer injury claims.
- CFBD: authenticated 2026 Michigan games request returned 12 records. User's onboarding email specifies 1,000 requests/calendar month. Independent schedule accuracy, player/roster coverage and CBBD entitlement remain unverified.
- SharpAPI: bounded odds request returned five records, with rate-limit header 12/minute. Freshness, sportsbook identity and entitlement details still need validation before production activation.
- The Odds API: supplied credential returned HTTP 401 on sports catalog. Preserve it privately, but mark access unavailable until account/key issue is resolved. Do not retry repeatedly or activate collection.
- football-data.org: competitions request returned HTTP 200 with 13 records; remaining-minute header was 9. Catalog size does not establish permission to retrieve every listed competition. Email verification remains unconfirmed.

No production secrets were installed, no billing changed, no scheduled collectors enabled and no D1 archive writes performed. Credentials are ready for server-side integration only after their data and access checks pass.
