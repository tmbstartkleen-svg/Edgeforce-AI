# Edgeforce V68 — Venue, Weather & Playing-Condition Intelligence

V68 replaces one-dimensional weather context with sport-aware playing-condition signals.

## Added
- Temperature and apparent-temperature stress
- Relative humidity
- Precipitation probability / amount and snowfall
- Sustained wind and gust load
- Venue elevation / altitude effects
- Indoor/dome suppression of weather noise
- Playing-surface normalization
- Sport-specific scoring, pace, home-edge and volatility effects
- Venue-condition snapshot warehouse and venue profiles
- API, deterministic regression route and dashboard panel
- Integration across fallback, team-score, player-prop, micro and shared-event simulations

## Compatibility
The legacy `weather` feature remains populated as a signed scoring-condition signal. V68-aware simulation paths prefer dedicated venue-condition features so weather is not double counted.
