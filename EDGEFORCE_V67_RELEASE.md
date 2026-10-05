# Edgeforce V67 — Schedule, Rest, Travel & Fatigue Intelligence

V67 turns schedule load into explicit simulation context.

## Added
- Team-specific rest-day calculation from actual schedules
- Back-to-back, 3-in-4, 4-in-6 and seven-day density detection
- Road-trip streak tracking
- Previous-venue to current-venue travel distance
- Timezone-shift and eastward-travel burden
- Recovery-time attenuation of travel burden
- Home/away fatigue and composite schedule edge
- Snapshot persistence and learned sport-level load profiles
- Intelligence API, regression route and dashboard panel
- Dedicated schedule features for fallback, team-score, player-prop, micro and shared-event simulations

## Compatibility
Legacy `rest`, `travel` and `fatigue` fields remain populated for older model paths. V67-aware simulations prefer the dedicated schedule composite to avoid double counting.
