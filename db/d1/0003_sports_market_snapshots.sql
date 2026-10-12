-- Additive, non-destructive D1 sportsbook archive; Neon remains untouched.
CREATE TABLE IF NOT EXISTS sports_market_snapshots (
 snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
 source_id TEXT NOT NULL,
 upstream_id TEXT NOT NULL,
 source_event_id TEXT NOT NULL,
 sport TEXT NOT NULL,
 league TEXT NOT NULL,
 home_team TEXT NOT NULL,
 away_team TEXT NOT NULL,
 start_time TEXT NOT NULL,
 market_key TEXT NOT NULL,
 selection_key TEXT NOT NULL,
 bookmaker TEXT NOT NULL,
 american_odds INTEGER NOT NULL,
 source_observed_at TEXT NOT NULL,
 ingested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=64),
 raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
 UNIQUE(source_id,source_event_id,market_key,selection_key,bookmaker,source_observed_at,payload_sha256)
);
CREATE INDEX IF NOT EXISTS idx_sports_market_recent ON sports_market_snapshots(source_event_id,market_key,selection_key,source_observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sports_market_source ON sports_market_snapshots(source_id,ingested_at DESC);
