# Sports network evidence and Monte Carlo display

The private operations dashboard's Sportsbook Coverage panel reads `/api/operations/sports-evidence`. It requires the existing operator token. `INTELLIGENCE_DB` supplies production odds and model runs; `SPORTS_NETWORK_DB` binds the existing isolated sports-network database for reads only. The handler contains only SELECT queries, no upstream calls or ingestion. Existing write and collection flags remain disabled.

## What the inventory proves

Every entry in `GLOBAL_SPORT_REGISTRY` appears even without observations. Enabled source IDs and upstream identities must match stored score observations. Known college-basketball and soccer feed aliases map to registry entries; unknown feeds remain separately visible. Score freshness is 24 hours. Neither registration nor stored scores certifies complete event/market coverage, source ownership, or odds availability. Bounded query limits are disclosed.

The October 25 audit found production sportsbook snapshots and model runs empty, with no enabled odds sources. The isolated network held score observations from 16 league feeds, dated October 22–23, and no odds or model runs. Existing score data is useful evidence of ingestion, not fresh sportsbook coverage. No scraped odds dataset was located in the project mirror. An actual dataset location and source provenance are needed before its data can be connected and verified.

## Monte Carlo evidence contract

Fresh odds must pass the existing source registry, timestamp, raw identity, settlement and outcome checks, a SHA-256 payload integrity check, and sport/team identity checks. The table shows a dedicated Monte Carlo percentage beside the book and odds, or Unavailable.

A stored `model_runs` row must match the quote's event, market and selection, have a model version, and be at most 20 minutes old with no future timestamp. Its `feature_snapshot` must contain:

- `quotePayloadSha256`: the exact archived quote fingerprint, including source identity and line/period fields in its raw payload.
- `monteCarlo`: `{ "runs": 1000, "hits": 650 }` describing actual recorded simulation trials. Runs must match `run_count`; hits must be an integer between zero and runs. These numbers are a contract example, not a forecast.
- `inputEvidence`: nonempty references with `source_id`, `upstream_id`, `event_id`, `payload_hash`, and `observed_at`. Each reference must match an existing network record joined to its enabled source and upstream. Inputs must be at most 24 hours old and must precede the run.

The percentage is hits/runs. A 95% Wilson interval describes trial sampling uncertainty only. It does not establish model accuracy, input suitability, independent calibration, profitability, or executable odds. Generic `model_probability` and de-vigged market probabilities are never relabelled as Monte Carlo output. No simulation run or evidence record is manufactured by this read-only endpoint. Existing archived runs without this provenance contract remain unavailable until independently reviewed and produced by a compatible model pipeline.

## Validation

Regression tests cover absent data across the full registry, stale feeds, authentication before database access, missing bindings, checksum and sport conflicts, invalid trials, wrong quote/event/selection, stale/future runs and unmatched input references. Both standard and Cloudflare CI execute these tests via posttypecheck.
