-- Additive pilot-only event attribution; apply before enabling reference ingest.
ALTER TABLE events ADD COLUMN source TEXT;
ALTER TABLE events ADD COLUMN observed_at TEXT;
