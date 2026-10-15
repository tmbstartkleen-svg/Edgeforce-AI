import test from 'node:test';import assert from 'node:assert/strict';
import {extractSoccerScoreObservations} from '../src/lib/intelligence-core/soccer-score-observation.mjs';
test('normalizes bounded real scoreboard fixtures without claiming licensed market evidence',()=>{
 const r=extractSoccerScoreObservations({events:[{id:'123',date:'2026-10-14T20:00:00Z'},{id:'123',date:'2026-10-14T20:00:00Z'},{id:'bad'}]},{leagueId:'eng.1',observedAt:'2026-10-14T19:00:00Z'});
 assert.equal(r.length,1);assert.equal(r[0].eventId,'123');assert.equal(r[0].sourceApproved,false);assert.equal(r[0].licensedOdds,false);
});
test('rejects invalid upstream data',()=>{assert.deepEqual(extractSoccerScoreObservations({events:'bad'},{leagueId:'eng.1',observedAt:'2026-10-14'}),[]);});
