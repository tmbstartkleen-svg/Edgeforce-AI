-- Build 351: reference entities only. Additive D1 schema; no Postgres cutover.
-- UTC timestamps are ISO-8601 text; JSON payloads require valid JSON.
CREATE TABLE IF NOT EXISTS teams (
 id TEXT PRIMARY KEY,
 sport TEXT NOT NULL,
 league TEXT,
 name TEXT NOT NULL,
 city TEXT,
 venue TEXT,
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata))
);

CREATE TABLE IF NOT EXISTS athletes (
 id TEXT PRIMARY KEY,
 sport TEXT NOT NULL,
 league TEXT,
 full_name TEXT NOT NULL,
 team_id TEXT,
 position TEXT,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS d1_athletes_team_idx ON athletes(team_id);

CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY,
 provider_event_id TEXT UNIQUE,
 sport TEXT NOT NULL,
 league TEXT,
 home_team_id TEXT,
 away_team_id TEXT,
 start_time TEXT NOT NULL,
 venue TEXT,
 status TEXT NOT NULL DEFAULT 'scheduled',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS events_time_idx ON events(start_time,sport,league);
