# Edgeforce AI

EV-first sports probability intelligence platform.

## Current build — V8

V8 introduces sport-specific modeling instead of routing every market through the same feature logic.

### Sport engines
- NFL
- MLB
- NBA
- WNBA
- NCAAB
- NHL
- NCAAF
- Soccer
- Tennis
- UFC / MMA
- Golf

Each sport uses its own weighted feature map. Examples include:
- NFL: quarterback, trenches, offense-vs-defense, weather, injury, rest
- MLB: starter, bullpen, handedness, park, lineup, weather
- Basketball: pace, usage, rest, shooting, matchup
- NHL: goalie, shot quality, special teams, rest
- Soccer: xG, keeper, tactical matchup, set pieces, form
- Tennis: surface, serve, return, fatigue, form
- UFC: striking, grappling, takedown defense, cardio, reach, weight cut
- Golf: course fit, approach, off-the-tee, putting, weather

### V8 architecture
1. Licensed/authorized sportsbook data is ingested
2. Historical context is transformed into sport-specific features
3. Sport engine estimates an adjusted probability
4. Sport Engine becomes a weighted member of the Model Council
5. Council disagreement is penalized
6. Adaptive Monte Carlo runs are selected
7. Fair odds, EV, Kelly, confidence, and Top 30 ranking are calculated
8. Sport features and model outputs are persisted for backtesting

### New API
- `GET /api/sports/models`
- `POST /api/sports/evaluate`

### Database
Apply migrations in order:

```
db/schema.sql
db/v6.sql
db/v7.sql
db/v8.sql
```

V8 adds:
- sport feature snapshots
- sport/market performance scorecards
- feature importance history

## Guardrails
- Sportsbook odds are prices, not predictions.
- The 30% daily gain figure is a dashboard goal, not a promised or forced return.
- Kelly exposure remains capped.
- Large model disagreement can downgrade a signal.
- The system can return **NO BET**.
- Production feeds should be licensed or otherwise authorized.
- Never commit API keys, database credentials, or secrets.
