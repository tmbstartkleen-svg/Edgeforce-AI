-- Additive schema only: no drops or mutations to observation history.
CREATE TABLE IF NOT EXISTS specialist_tasks (
 task_id TEXT PRIMARY KEY,
 agent_id TEXT NOT NULL,
 division TEXT NOT NULL CHECK (division IN ('SPORTS','PREDICTION_MARKETS','PLATFORM')),
 source_id TEXT NOT NULL,
 task_kind TEXT NOT NULL,
 task_state TEXT NOT NULL DEFAULT 'PENDING' CHECK (task_state IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
 payload_json TEXT NOT NULL DEFAULT '{}',
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 next_attempt_at TEXT,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_specialist_tasks_queue ON specialist_tasks(task_state,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS idx_specialist_tasks_division ON specialist_tasks(division,created_at);
CREATE TABLE IF NOT EXISTS specialist_task_events (
 event_id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id TEXT NOT NULL REFERENCES specialist_tasks(task_id),
 state TEXT NOT NULL,
 event_at TEXT NOT NULL DEFAULT (datetime('now')),
 detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_specialist_events_task ON specialist_task_events(task_id,event_id);
