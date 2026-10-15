-- Build 353: additive SQLite/D1 translation of baseline sports persistence tables.
-- Structural coverage does not imply PostgreSQL historical migration or query parity.
-- Caller must supply UUID for weather_snapshots.id; ISO-8601 UTC strings for timestamps.
CREATE TABLE IF NOT EXISTS market_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL,
 provider TEXT NOT NULL,
 bookmaker TEXT NOT NULL,
 market_key TEXT NOT NULL,
 selection_key TEXT NOT NULL,
 american_odds INTEGER NOT NULL,
 point REAL,
 pulled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 raw TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(raw))
);
CREATE INDEX IF NOT EXISTS market_lookup_idx ON market_snapshots(event_id,market_key,selection_key,pulled_at DESC);
CREATE TABLE IF NOT EXISTS player_game_stats (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 athlete_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 stat_date TEXT NOT NULL,
 stats TEXT NOT NULL CHECK(json_valid(stats)),
 source TEXT,
 imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(athlete_id,event_id)
);
CREATE TABLE IF NOT EXISTS injury_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 athlete_id TEXT,
 team_id TEXT,
 status TEXT,
 detail TEXT,
 source TEXT,
 reported_at TEXT,
 pulled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS weather_snapshots (
 id TEXT PRIMARY KEY,
 event_id TEXT NOT NULL,
 temp_f REAL,
 wind_mph REAL,
 precip_prob REAL,
 humidity REAL,
 roof_status TEXT,
 payload TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload)),
 pulled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS model_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL,
 market_key TEXT NOT NULL,
 selection_key TEXT NOT NULL,
 model_version TEXT NOT NULL DEFAULT 'edgeforce-v4',
 run_count INTEGER NOT NULL,
 market_probability REAL NOT NULL,
 model_probability REAL NOT NULL,
 fair_american_odds INTEGER,
 expected_value REAL,
 full_kelly REAL,
 fractional_kelly REAL,
 agreement REAL,
 confidence REAL,
 grade TEXT,
 feature_snapshot TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(feature_snapshot)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS model_runs_rank_idx ON model_runs(created_at DESC,expected_value DESC,confidence DESC);
CREATE TABLE IF NOT EXISTS bet_results (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 model_run_id INTEGER REFERENCES model_runs(id),
 event_id TEXT,
 market_key TEXT,
 selection_key TEXT,
 offered_odds INTEGER,
 closing_odds INTEGER,
 result TEXT,
 clv REAL,
 pnl REAL,
 settled_at TEXT
);
CREATE TABLE IF NOT EXISTS calibration_metrics (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 model_version TEXT,
 sport TEXT,
 market_key TEXT,
 sample_size INTEGER,
 brier_score REAL,
 log_loss REAL,
 calibration_error REAL,
 period_start TEXT,
 period_end TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
