import test from 'node:test';import assert from 'node:assert/strict';
import {auditObservationHistory} from '../src/lib/intelligence-core/d1-history-quality-audit.mjs';
test('audit counts fresh, duplicate, stale and invalid history without certifying bets',()=>{
 const now=Date.parse('2026-10-19T20:00:00Z');
 const row={source_id:'p1',upstream_id:'u1',event_id:'e1',market_id:null,observation_kind:'odds',observed_at:'2026-10-19T19:59:00Z',payload_hash:'sha'};
 const old={...row,event_id:'e2',observed_at:'2026-10-17T20:00:00Z'};
 const bad={...row,event_id:'e3',payload_hash:''};
 const x=auditObservationHistory([row,row,old,bad],{now});
 assert.deepEqual([x.accepted,x.duplicates,x.stale,x.invalid],[1,1,1,1]);
 assert.equal(x.sources[0].records,1);assert.equal(x.oddsOfficiallyVerified,false);
 assert.equal(x.betRecommendationAuthorized,false);assert.equal(x.readOnly,true);
});
