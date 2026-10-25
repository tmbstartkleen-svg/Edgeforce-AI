# Sports data coverage audit — 2026-10-25

## Verified account evidence

BetStack credentials authenticated successfully for sports and leagues (HTTP 200). The sports catalog lists 15 sports plus Politics; the leagues catalog contains 168 competition entries. These are catalog claims, not verified current schedules, injuries or tradable prices.

A read-only request to `/api/v1/events?league_key=basketball_nba&date=2026-10-26` returned HTTP 200 and 346 records. The first record was Tasmania JackJumpers vs Cairns Taipans in `basketball_nbl`, scheduled `2025-11-01T06:30:00.000Z`. This fails both requested filters. Do not activate production collection based on this response. The local gateway now rejects event collections containing mismatched requested league keys or UTC dates. It does not certify unfiltered schedules or other endpoint contracts.

Credentials remain outside source control. No billing, scheduled collection or archive writes were activated.

### Catalog entries by category

| Category | Entries |
|---|---:|
| American Football | 8 |
| Aussie Rules | 2 |
| Baseball | 7 |
| Basketball | 11 |
| Boxing | 1 |
| Cricket | 13 |
| Golf | 4 |
| Handball | 1 |
| Ice Hockey | 7 |
| Lacrosse | 2 |
| Mixed Martial Arts | 1 |
| Politics | 1 |
| Rugby League | 3 |
| Rugby Union | 1 |
| Soccer | 60 |
| Tennis | 46 |

## Provider candidates

| Source | Useful coverage | Verified access / limitation |
|---|---|---|
| [BetStack](https://api.betstack.dev/docs) | 15 sports; consensus odds, schedules, results, teams | Authenticated catalog only; schedule quality check failed; 1 request/minute/key |
| [SportScore](https://sportscore.com/developers/) | Soccer, basketball, cricket, tennis scores and statistics | Existing opt-in adapter; keyless attribution tier; current production connectivity not verified; no bookmaker feed established |
| [SharpAPI](https://sharpapi.io/pricing) | Sportsbook odds | Existing opt-in adapter; published free tier 2 books, 12 requests/minute, 60-second delay; account access not verified |
| [FieldFunded](https://www.fieldfunded.com/docs) | Advertised 30+ sports/esports odds and scores | Free signup attempted; UI reported network error; no key confirmed; advertised 10,000 requests/month, no card; catalog unverified |
| [Sportradar](https://developer.sportradar.com/getting-started/docs/get-started) | Broad professional sports data, including motorsport, volleyball, table tennis, darts, winter sports | Enterprise candidate; no account, commercial rights, pricing or service-level agreement verified |
| [OpticOdds injuries](https://developer.opticodds.com/reference/get_injuries) | NFL, NBA, NHL, MLB, NCAAF/NCAAB and top soccer injuries | Documented endpoint; no authenticated access verified |

Sportradar is the strongest broad-coverage candidate from this review, not a measured winner for latency or completeness. Compare actual licensed competitions, permitted dashboard use, injury latency, lineup confirmation, historical depth and sportsbook coverage before purchase. Existing credentials only authorize their issuing service; premium feeds cannot be unlocked using a BetStack key.

## Public repository review

Read repository metadata and README documentation without executing third-party code or collecting secrets.

| Repository | Use | License / limitation |
|---|---|---|
| [nflverse-data](https://github.com/nflverse/nflverse-data) | Published NFL data release assets | Repository CC-BY-4.0; check dataset source and release freshness; not a universal real-time injury feed |
| [sportsdataverse-py](https://github.com/sportsdataverse/sportsdataverse-py) | Clients for pro/college basketball, football, hockey, baseball, soccer and cricket | MIT client; upstream access and data rights remain separate; broad README claims not endpoint-by-endpoint tested |
| [StatsBomb open data](https://github.com/hudl/open-data) | Selected historical soccer competitions and event data | Custom data terms and attribution; not tomorrow's live odds or universal soccer coverage |
| [pybaseball](https://github.com/jldbc/pybaseball) | Baseball statistics and Statcast clients | MIT client; upstream terms and freshness still apply |
| [nba_api](https://github.com/swar/nba_api) | NBA statistics and live data clients, some WNBA/G League support | MIT client; NBA data terms apply; upstream can throttle/block hosted requests |

The legacy JeffSackmann/tennis_atp and tennis_wta repository paths returned 404 during this audit; do not wire these unavailable locations into production.

## Remaining gaps and release conditions

BetStack's verified sport catalog does not establish coverage for motorsports, volleyball, table tennis, badminton, darts, snooker, cycling, winter sports, esports or every NCAA sport. A registry entry is a target, not a connected feed. Even supported sports need competition-level checks.

Before displaying a sport as connected, require a successful current fixture sample, stable team/event IDs, source observation timestamps, odds market/book identity, roster/injury evidence where relevant, and explicit unavailable status for gaps. Monte Carlo percentages require separately validated models; provider odds alone do not supply them. Cash-out availability requires the user's sportsbook and cannot be inferred from consensus odds.

The free gateway still needs durable shared quota state before production deployment. This audit enables no paid plan, production feed, scraper job, archive writer or scheduled task.
