import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPlayerStreakEvidence } from '../src/lib/intelligence-core/player-streak-evidence.mjs';

const row = (id, overrides = {}) => ({
  eventId: id, playerId: 'athlete-1', date: '2026-11-02T12:00:00Z',
  completed: true, stats: { assists: 7 },
  sourceUrl: 'https://www.espn.com/nba/boxscore/_/gameId/' + id,
  ...overrides,
});
const evaluate = (games) => reviewPlayerStreakEvidence({
  playerId: 'athlete-1', games, stat: 'assists', threshold: 6,
  asOf: '2026-11-09T12:00:00Z',
});
test('rejects other athletes, future games, missing provenance and duplicate events', () => {
  const r = evaluate([
    row('1'), row('1'), row('2', { playerId: 'athlete-2' }),
    row('3', { date: '2026-11-10T00:00:00Z' }),
    row('4', { sourceUrl: null }), row('5', { completed: false }),
    row('6', { stats: {} }),
  ]);
  assert.equal(r.acceptedCount, 1);
  assert.equal(r.rejectedCount, 6);
  assert.deepEqual(new Set(r.rejected.map(x => x.reason)),
    new Set(['DUPLICATE_EVENT','PLAYER_MISMATCH','AFTER_AS_OF','MISSING_SOURCE','NOT_COMPLETED','MISSING_STAT']));
  assert.equal(r.status, 'INSUFFICIENT_HISTORY');
  assert.equal(r.modelProbability, null);
  assert.equal(r.executableSelection, false);
});
test('five verified games show observed history, not a forecast or executable wager', () => {
  const r = evaluate(Array.from({ length: 5 }, (_, i) => row(String(i+1))));
  assert.equal(r.last5.hitRate, 1);
  assert.equal(r.last10.hitRate, null);
  assert.equal(r.status, 'OBSERVED_HISTORY_ONLY');
  assert.equal(r.modelProbability, null);
  assert.equal(r.executableSelection, false);
});
test('requires an athlete identity and a valid as-of cutoff', () => {
  assert.throws(() => reviewPlayerStreakEvidence({ playerId:'', games:[], asOf:'2026-11-09' }),
    /INVALID_PLAYER_EVIDENCE_INPUT/);
  assert.throws(() => reviewPlayerStreakEvidence({ playerId:'p', games:[], asOf:'wrong' }),
    /INVALID_PLAYER_EVIDENCE_INPUT/);
});
