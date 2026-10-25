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

## Additional supplied credentials: authenticated audit

TheRundown and PropLine keys were saved in owner-only files outside the repository. No passwords were reused across providers. TheRundown sports catalog returned HTTP 200 with 36 entries (including Politics and competition variants); event and price quality remains unverified.

PropLine sports catalog returned 71 categories. A bounded manual read of each category’s events endpoint returned 71 HTTP 200 responses: 60 categories had future-dated records and 11 were empty. All returned records had matching sport keys and parseable start times. This is a response-shape check, not independent verification of fixtures or current bookmaker offers. Cycling only returned a 2027 Tour de France entry, so it does not establish near-term coverage. Past-start records also appear in several responses; never treat the entire response as upcoming.

PropLine reports a free daily limit of 1,000. Remaining-quota headers varied non-monotonically across sequential requests; local accounting must remain conservative rather than assuming returned values are a reliable global counter. Existing adapters for both services remain opt-in; no production activation was performed.

| PropLine category | Returned records | Future-dated at check |
|---|---:|---:|
| MLB (`baseball_mlb`) | 2 | 2 |
| NBA (`basketball_nba`) | 119 | 117 |
| NFL (`football_nfl`) | 24 | 21 |
| NHL (`hockey_nhl`) | 52 | 51 |
| NCAAB (`basketball_ncaab`) | 6 | 6 |
| NCAAF (`football_ncaaf`) | 207 | 207 |
| Golf (`golf`) | 49 | 4 |
| Tennis (`tennis`) | 426 | 395 |
| EPL (`soccer_epl`) | 21 | 21 |
| La Liga (`soccer_la_liga`) | 21 | 21 |
| Serie A (`soccer_serie_a`) | 20 | 20 |
| Bundesliga (`soccer_bundesliga`) | 18 | 18 |
| Ligue 1 (`soccer_ligue_1`) | 19 | 19 |
| MLS (`soccer_mls`) | 46 | 46 |
| UFC (`mma_ufc`) | 35 | 35 |
| Boxing (`boxing`) | 74 | 67 |
| Championship (`soccer_championship`) | 12 | 12 |
| Eredivisie (`soccer_eredivisie`) | 18 | 18 |
| Liga MX (`soccer_liga_mx`) | 12 | 12 |
| Primeira Liga (`soccer_primeira_liga`) | 8 | 8 |
| Brasileirão (`soccer_brasileirao`) | 22 | 22 |
| Liga Profesional (`soccer_argentina_primera`) | 21 | 20 |
| Scottish Premiership (`soccer_scottish_premiership`) | 16 | 16 |
| Saudi Pro League (`soccer_saudi_pro`) | 13 | 13 |
| Eliteserien (`soccer_eliteserien`) | 8 | 8 |
| J1 League (`soccer_japan_j_league`) | 10 | 10 |
| Süper Lig (`soccer_turkey_super_lig`) | 11 | 11 |
| Belgian Pro League (`soccer_belgium_pro_league`) | 9 | 9 |
| Allsvenskan (`soccer_sweden_allsvenskan`) | 14 | 14 |
| Greek Super League (`soccer_greek_super_league`) | 18 | 18 |
| Swiss Super League (`soccer_swiss_super_league`) | 7 | 6 |
| A-League (`soccer_a_league`) | 12 | 12 |
| UEFA Champions League (`soccer_uefa_champions_league`) | 28 | 28 |
| WNBA (`basketball_wnba`) | 2 | 2 |
| Copa Libertadores (`soccer_copa_libertadores`) | 1 | 1 |
| Copa Sudamericana (`soccer_copa_sudamericana`) | 1 | 1 |
| UEFA Europa League (`soccer_uefa_europa_league`) | 26 | 26 |
| UEFA Conference League (`soccer_uefa_conference_league`) | 23 | 23 |
| Rugby League (`rugby_league`) | 5 | 5 |
| Rugby Union (`rugby_union`) | 0 | 0 |
| College Baseball (`baseball_ncaa`) | 0 | 0 |
| Racing (`motorsport_racing`) | 7 | 3 |
| Table Tennis (`table_tennis`) | 115 | 50 |
| Cricket (`cricket`) | 21 | 15 |
| Darts (`darts`) | 16 | 15 |
| UEFA Nations League (`soccer_uefa_nations_league`) | 36 | 36 |
| FIFA World Cup (`soccer_fifa_world_cup`) | 0 | 0 |
| Esports (`esports`) | 149 | 130 |
| CFL (`football_cfl`) | 2 | 2 |
| NBA Summer League (`basketball_nba_summer_league`) | 0 | 0 |
| AFL (`aussie_rules_afl`) | 0 | 0 |
| Volleyball (`volleyball`) | 36 | 15 |
| Badminton (`badminton`) | 0 | 0 |
| Snooker (`snooker`) | 0 | 0 |
| Cycling (`cycling`) | 1 | 1 |
| 2. Bundesliga (`soccer_germany_bundesliga2`) | 18 | 18 |
| DFB-Pokal (`soccer_germany_dfb_pokal`) | 16 | 16 |
| NCAAW (`basketball_ncaaw`) | 7 | 7 |
| Segunda División (`soccer_spain_segunda_division`) | 9 | 9 |
| EuroLeague (`basketball_euroleague`) | 20 | 20 |
| Serie B (`soccer_italy_serie_b`) | 22 | 22 |
| League Two (`soccer_england_league2`) | 19 | 19 |
| J2 League (`soccer_japan_j2_league`) | 10 | 10 |
| Eerste Divisie (`soccer_netherlands_eerste_divisie`) | 8 | 8 |
| Liga ACB (`basketball_spain_acb`) | 0 | 0 |
| Lega Basket Serie A (`basketball_italy_lega_a`) | 0 | 0 |
| Basketball Bundesliga (`basketball_germany_bbl`) | 3 | 3 |
| LNB Élite (`basketball_france_lnb`) | 0 | 0 |
| Basketbol Süper Ligi (`basketball_turkey_bsl`) | 0 | 0 |
| Greek Basket League (`basketball_greece_basket_league`) | 3 | 3 |
| Korisliiga (`basketball_finland_korisliiga`) | 2 | 2 |

Additional supplemental candidates: [OpenF1](https://openf1.org/) offers free historical F1 data; live access is paid. [Cricsheet](https://cricsheet.org/) provides historical cricket ball-by-ball data and identity registers. [TheSportsDB](https://www.thesportsdb.com/api.php) offers metadata/artwork; enhanced live features require premium access. These are different data products, not substitutes for verified current odds and injuries. No paid plan was selected.
