# Edgeforce provider layer

V15 provider adapters intentionally use environment configuration rather than hard-coded vendor credentials.

Supported capability slots:
- ODDS: primary, secondary, tertiary
- WEATHER: primary, secondary
- INJURIES: primary, secondary
- STATS: primary
- RESULTS: primary
- PREDICTION_MARKETS: primary

All live provider responses must be normalized before they enter model, Kelly, parlay, or portfolio code. Provider failures are handled by priority-based failover, followed by stored data and finally demo data for development/testing.

Do not commit provider secrets.
