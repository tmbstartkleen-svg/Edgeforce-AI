-- EdgeForce Cloudflare D1 pilot. Separate from Postgres; never deletes existing data.
CREATE TABLE IF NOT EXISTS intelligence_sources (
 source_id TEXT PRIMARY KEY,
 upstream_id TEXT NOT NULL,
 source_type TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);
CREATE TABLE IF NOT EXISTS intelligence_observations (
 observation_id INTEGER PRIMARY KEY AUTOINCREMENT,
 source_id TEXT NOT NULL REFERENCES intelligence_sources(source_id),
 upstream_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 market_id TEXT,
 observation_kind TEXT NOT NULL CHECK(observation_kind IN ('score','odds','injury','lineup','player-stat','weather','prediction-market','result')),
 observed_at TEXT NOT NULL,
 ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 payload_hash TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 UNIQUE(source_id,event_id,observation_kind,observed_at,payload_hash)
);
CREATE INDEX IF NOT EXISTS intelligence_observations_event_idx ON intelligence_observations(event_id,observation_kind,observed_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_observations_ingest_idx ON intelligence_observations(ingested_at DESC);
