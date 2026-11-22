-- Paper-only scalp snapshot state. Apply to an isolated staging database first.
-- This migration does not enable exchange connectivity or live order placement.
CREATE TABLE IF NOT EXISTS edgeforce_paper_scalp_snapshots (
  market_id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE edgeforce_paper_scalp_snapshots IS
  'EdgeForce research-only paper scalp state; writes require atomic revision checks';
