-- EdgeForce additive prediction-market watch and alert ledger.
-- Watch registration never certifies exchange contract equivalence.
CREATE TABLE IF NOT EXISTS prediction_arbitrage_watches (
 watch_id TEXT PRIMARY KEY,
 kalshi_ticker TEXT NOT NULL,
 poly_yes_token TEXT NOT NULL,
 poly_no_token TEXT NOT NULL,
 minimum_net_roi_pct REAL NOT NULL CHECK(minimum_net_roi_pct>=0 AND minimum_net_roi_pct<=100),
 contract_pairs INTEGER NOT NULL CHECK(contract_pairs>=1 AND contract_pairs<=100000),
 expiry_at TEXT,
 settlement_verified INTEGER NOT NULL DEFAULT 0 CHECK(settlement_verified IN (0,1)),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS prediction_watches_expiry_idx ON prediction_arbitrage_watches(expiry_at,enabled);
CREATE TABLE IF NOT EXISTS prediction_arbitrage_observations (
 observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
 watch_id TEXT NOT NULL REFERENCES prediction_arbitrage_watches(watch_id),
 observed_at TEXT NOT NULL,
 kalshi_yes_ask_cents REAL,
 kalshi_no_ask_cents REAL,
 poly_yes_ask_cents REAL,
 poly_no_ask_cents REAL,
 minimum_combined_cents REAL,
 status TEXT NOT NULL CHECK(status IN ('REVIEW_REQUIRED','NO_PRICE','INCOMPLETE_BOOK','STALE','NO_SPREAD','NOT_CERTIFIED')),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(watch_id,observed_at,status)
);
CREATE INDEX IF NOT EXISTS prediction_observations_watch_idx ON prediction_arbitrage_observations(watch_id,observed_at DESC);
CREATE TABLE IF NOT EXISTS prediction_arbitrage_alerts (
 alert_id INTEGER PRIMARY KEY AUTOINCREMENT,
 watch_id TEXT NOT NULL REFERENCES prediction_arbitrage_watches(watch_id),
 observation_id INTEGER REFERENCES prediction_arbitrage_observations(observation_id),
 status TEXT NOT NULL CHECK(status IN ('REVIEW_REQUIRED','SUPPRESSED')),
 reason TEXT NOT NULL,
 first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 confirmed_executable INTEGER NOT NULL DEFAULT 0 CHECK(confirmed_executable=0),
 delivery_state TEXT NOT NULL DEFAULT 'NOT_DISPATCHED' CHECK(delivery_state='NOT_DISPATCHED'),
 UNIQUE(watch_id,observation_id,status)
);
