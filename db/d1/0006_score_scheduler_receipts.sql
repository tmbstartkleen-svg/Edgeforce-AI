-- Durable execution receipts for isolated scoreboard scheduler.
-- Additive only; does not enable scheduled collection or alter observations.
CREATE TABLE IF NOT EXISTS score_scheduler_receipts (
  run_id TEXT NOT NULL,
  cohort INTEGER NOT NULL CHECK (cohort IN (0,1)),
  scheduled_at TEXT NOT NULL,
  sport TEXT NOT NULL,
  source_id TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  final_status INTEGER,
  completed_at TEXT,
  persisted INTEGER NOT NULL DEFAULT 0 CHECK (persisted IN (0,1)),
  outcome TEXT NOT NULL CHECK (outcome IN ('RUNNING','PERSISTED','NO_QUALIFYING_EVENTS','PERSISTENCE_UNCONFIRMED','FAILED')),
  PRIMARY KEY (run_id, sport)
);
CREATE INDEX IF NOT EXISTS score_scheduler_receipts_scheduled_idx
  ON score_scheduler_receipts (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS score_scheduler_receipts_outcome_idx
  ON score_scheduler_receipts (outcome, scheduled_at DESC);
