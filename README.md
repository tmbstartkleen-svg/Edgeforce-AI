# Edgeforce AI

Cross-market sports probability, simulation, parlay and bankroll intelligence workspace.

## Current build — V27 Automated Settlement + Bankroll Ledger

V27 turns the result-history layer into a persistent wager ledger that can record open tickets, reconcile provider results, settle parlays, update bankroll state, and calculate rolling performance.

### V27 ledger engine
- persistent wager and leg storage
- exact September 29, 2026 baseline retained: $25 staked, $32 returned, +$7 net, +28% ROI
- open, win, loss and push wager states
- combined ticket odds, potential return and modeled probability storage
- per-leg event, market, odds and model-probability audit fields
- manual/API wager recording
- manual/API settlement
- result-provider reconciliation for matching open legs
- hourly automatic settlement cron when a results provider is configured
- winning wagers without a known ticket price or return are not assigned an invented payout

### Performance analytics
- cumulative settled stake, return, net P/L and ROI
- individual-leg hit rate by sport
- market-type hit rate
- parlay hit rate by leg count
- sport-by-sport parlay performance
- model-probability bands
- average modeled probability for known winners and losers
- best-performing sport and parlay size once a minimum settled sample exists
- open wagers excluded from settled ROI/hit-rate calculations

### APIs
- `GET /api/live-board`
- `GET /api/ledger/wagers`
- `POST /api/ledger/wagers`
- `POST /api/ledger/settle`
- `POST /api/results/ingest`
- `GET /api/cron/settle`
- `GET /api/health`

### V26 intelligence retained
- raw sportsbook implied probability
- complete-market de-vig probability
- liquid prediction-market matching
- sport-specific Monte Carlo
- model-vs-sportsbook and model-vs-prediction-market edge
- conservative quarter-Kelly
- player context and SGP correlation
- Model Council ensemble and learned historical weights

### Guardrails
- Open wagers never count as losses.
- Unknown or hidden leg outcomes remain unknown.
- Ambiguous result-provider rows are skipped.
- Prediction-market data must pass matching and liquidity gates.
- Missing payout information is never fabricated.
- Simulation, edge, Kelly sizing and performance analytics are estimates and historical measurements, not guarantees.
