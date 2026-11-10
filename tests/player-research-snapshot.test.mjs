import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerResearchSnapshot } from '../src/lib/intelligence-core/player-research-snapshot.mjs';
const asOf = '2026-11-09T18:00:00Z';
const game = i => ({
  playerId:'nba-athlete-1', eventId:'evt-'+i, upstreamId:'espn-game-log',
  completed:true, date:'2026-11-0'+(8-i)+'T12:00:00Z',
  observedAt:'2026-11-09T17:00:00Z', sourceUrl:'https://www.espn.com/',
  stats:{rebounds:i+5},
});
const run = games => buildPlayerResearchSnapshot({
  playerId:'nba-athlete-1', sport:'nba', games, stat:'rebounds', threshold:5, asOf,
});
test('audited five-game streak stays historical and cannot create a slip', () => {
  const r=run([0,1,2,3,4].map(game));
  assert.equal(r.status,'HISTORICAL_RESEARCH_ONLY');
  assert.equal(r.streak.last5.hits,5);
  assert.equal(r.streak.last5.hitRate,1);
  assert.equal(r.modelProbability,null);
  assert.equal(r.approvedForBetting,false);
  assert.equal(r.slipUrl,null);
});
test('stale report and mismatched athlete never enter streak calculations', () => {
  const r=run([game(0),{...game(1),observedAt:'2026-11-07T00:00:00Z'}, {...game(2),playerId:'other'}]);
  assert.equal(r.status,'RESEARCH_INCOMPLETE');
  assert.equal(r.streak.acceptedCount,1);
  assert.equal(r.audit.stale,1);
  assert.equal(r.approvedForBetting,false);
});
test('invalid as-of time is rejected', () => {
  assert.throws(()=>buildPlayerResearchSnapshot({playerId:'p',sport:'nba',games:[],stat:'points',threshold:10,asOf:'bad'}),/INVALID_RESEARCH_AS_OF/);
});

test('future-dated games cannot count as verified streak records', () => {
  const row = {...game(0), date:'2026-11-10T12:00:00Z'};
  const r=run([row,game(1),game(2),game(3),game(4)]);
  assert.equal(r.streak.acceptedCount,4);
  assert.equal(r.status,'RESEARCH_INCOMPLETE');
});
test('repeated event IDs cannot inflate the last-five sample', () => {
  const r=run([game(0),game(0),game(1),game(2),game(3)]);
  assert.equal(r.streak.acceptedCount,4);
  assert.equal(r.status,'RESEARCH_INCOMPLETE');
});
