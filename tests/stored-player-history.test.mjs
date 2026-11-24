import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoredPlayerHistory } from '../src/lib/intelligence-core/stored-player-history.mjs';
test('no demo bootstrap data can claim authentic player research',()=>{
 const r=normalizeStoredPlayerHistory({source:'demo',history:[]},'p1');
 assert.equal(r.status,'NO_VERIFIED_DATABASE_HISTORY');
 assert.deepEqual(r.rows,[]);
});
test('legacy database rows do not gain invented completion or observation timestamps',()=>{
 const r=normalizeStoredPlayerHistory({source:'database',history:[
 {event_id:'123',stat_date:'2026-11-08',stats:{assists:8,minutes:'35'},source:'espn-public-gamelog'}
 ]},'nba-1');
 assert.equal(r.status,'MISSING_PROVENANCE');
 assert.equal(r.rows[0].completed,false);
 assert.equal(r.rows[0].observedAt,null);
 assert.equal(r.rows[0].sourceUrl,null);
 assert.deepEqual(r.rows[0].stats,{assists:8});
});
test('malformed history rejected',()=>assert.throws(
 ()=>normalizeStoredPlayerHistory({source:'database',history:{}},'p'),/INVALID_PLAYER_HISTORY_RESPONSE/
));

test('preserves explicitly sourced ESPN completion evidence and exact observation time',()=>{
 const r=normalizeStoredPlayerHistory({source:'database',history:[{
  event_id:'987',stat_date:'2026-11-08',source:'espn-public-gamelog',
  completedEvidence:'true',observedAt:'2026-11-09T10:00:00Z',
  sourceUrl:'https://www.espn.com/nba/game/_/gameId/987',stats:{assists:9}
 }]},'nba-123');
 assert.equal(r.rows[0].completed,true);
 assert.equal(r.rows[0].observedAt,'2026-11-09T10:00:00Z');
 assert.equal(r.rows[0].sourceUrl,'https://www.espn.com/nba/game/_/gameId/987');
 assert.equal(r.status,'PROVENANCE_REVIEW_REQUIRED');
});
test('non-ESPN source cannot certify game completion with a raw flag',()=>{
 const r=normalizeStoredPlayerHistory({source:'database',history:[{
  event_id:'987',stat_date:'2026-11-08',source:'unverified',
  completedEvidence:'true',observedAt:'2026-11-09T10:00:00Z',
  sourceUrl:'https://www.espn.com/nba/game/_/gameId/987',stats:{assists:9}
 }]},'nba-123');
 assert.equal(r.rows[0].completed,false);
 assert.equal(r.status,'MISSING_PROVENANCE');
});
