# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build
V4 foundation: model council, adaptive simulations, fair-odds/EV/Kelly ranking, Top 30 views, correlation-aware parlays, historical-learning schema, and provider-ready ingestion architecture.

## Principles
- Sportsbook odds are a price, not a prediction.
- Model probability is compared against break-even and no-vig probability.
- Positive expected value, calibration, confidence, and closing-line value matter more than raw hit rate.
- A 30% daily gain is a dashboard goal, never a guaranteed return or forced betting target.
- The engine may return **NO BET** when no market qualifies.

## Run
```bash
npm install
npm run dev
```

## Production data
Connect authorized/licensed odds, injury, weather, results, and historical-data feeds through environment variables. Never commit API keys.
