# V201 one-league sportsbook price review pilot

V201 prepares the zero-credit pilot for the next authorized sportsbook feeds. At the V200 baseline, production reported zero approved independent feeds, zero corroborated markets and zero normalized sportsbook markets. The repository had no approval or generic odds endpoint secrets for a live trial. The Odds API remained on quota-free preflight, with 2 credits remaining against its 25-credit reserve. V201 leaves the production pilot unconfigured.

## Review behavior

- During a poll, the newest evidence applies across all outcome sets of the same book market. Withdrawals, incomplete revisions and same-time price conflicts prevent older syndicated prices from reappearing. The next poll retains recent revision evidence inside its Worker isolate and only uses open quotes from feeds that responded to that poll. A strictly newer, complete open revision can be reviewed.
- The revision history is bounded. It covers the maximum five-minute price lifetime and withholds publication if it reaches capacity. It is local to the Worker isolate and is cleared by worker replacement. Cross-isolate withdrawal continuity still needs live verification or shared revision storage before broader rollout.
- Both board and status APIs re-evaluate the current review when publishing cached responses. Expired quotes disappear at their original expiry. If two other current independent sources still match, those quotes remain available. Successfully parsed feeds are counted separately from malformed or oversized responses.
- An optional shared `pilotScope` in `ODDS_PRICE_REVIEW_APPROVALS` limits all generic review slots to one normalized sport and league. For example, set `"pilotScope":{"sport":"Basketball","league":"NBA"}` alongside the source entries. Malformed scope blocks approval. Missing or mismatched approvals fail before collection. A generic odds slot cannot invoke a native provider alias.
- A review-only response can expose current observations without changing normalized model readiness. Review continues to exclude forecasts, expected value, staking and wagering. No migration, new service, paid provider or schedule change is required.

## Rehearse one market offline

Run `npm run price-review:pilot` to run the bundled synthetic example. It checks a match, withdrawal, reopening, source outage and expiry through the production normalizer and revision logic. It also checks expiry through the cached publication reader. The evidence label is `SYNTHETIC_REPLAY`.

To test a capture supplied by authorized operators, use `npm run price-review:pilot -- --example` to see the input format, then `npm run price-review:pilot -- --file /path/to/capture.json`. Use an authorized local capture with no credentials. The output is a summary labeled `OPERATOR_SUPPLIED_REPLAY`. Both modes make zero network requests and report `productionVerified: false`. The runner exits unsuccessfully if the expected lifecycle evidence is incomplete.

## Close the live pilot

The live milestone still requires two independently operated feeds with authorization to supply and display sportsbook prices, actual source update timestamps, and overlapping coverage of the chosen league. Once configured, verify the same lifecycle in production. Confirm that a withdrawal persists across Worker isolates before expanding the trial. Forecast validation remains a separate requirement for any model or EV use.

The Cloudflare workflow retries the authenticated warehouse audit briefly if the newly rotated credentials return HTTP 401. It still requires an authenticated audit response to continue.
