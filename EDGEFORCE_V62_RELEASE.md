# Edgeforce V62 — Player/Roster Intelligence DataFrame Engine

V62 extends the existing player warehouse into simulation-ready feature frames.

## Added
- Rolling player form and volatility signals
- Home/away split signals
- Opponent-history signals
- Usage trend signals
- Roster continuity snapshots
- Current weather context carried into player frames
- Persistent player learning state
- Hourly player feature-frame snapshots
- Player intelligence API and regression endpoint
- Dashboard observability
- Direct integration with Monte Carlo simulation inputs

## Data flow
Provider/player history → player warehouse → V62 feature frames → context fusion → simulation → persistence → learning state.

## Database
Migration: `db/v73.sql`

## Safety
V62 uses historical and contextual signals as bounded simulation adjustments. It does not replace the existing model council, calibration, quality gates, or recommendation thresholds.
