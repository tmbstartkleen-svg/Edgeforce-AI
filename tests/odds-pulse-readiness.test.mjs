import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePulse,probe} from '../scripts/odds-pulse-readiness.mjs';
const now=Date.parse('2026-10-23T23:00:00Z');
const good={ok:true,source:'fanlinewire',mode:'keyless-public-snapshot',fresh:true,generatedAt:new Date(now-30000).toISOString(),rows:[{sport:'NHL',fixture:'A vs B',prices:[{american:-110}]}]};
test('priced fresh snapshot is evidence of pulse only, never DraftKings or +EV',()=>{
 const r=evaluatePulse(good,200,now);assert.equal(r.verdict,'LIVE_SNAPSHOT_OBSERVED');assert.equal(r.draftKingsVerified,false);assert.equal(r.crossBookEdgesCertified,false);assert.equal(r.independentUpstreamsVerified,0);
});
test('stale and unpriced snapshot fail closed',()=>{
 const r=evaluatePulse({...good,generatedAt:new Date(now-200000).toISOString(),rows:[]},200,now);assert.deepEqual(r.reasons,['SNAPSHOT_STALE_OR_UNTIMESTAMPED','NO_USABLE_AMERICAN_ODDS']);
});
test('HTTP 503 is unavailable even with structurally valid payload',()=>assert.ok(evaluatePulse(good,503,now).reasons.includes('SOURCE_UNAVAILABLE')));
test('probe requests only expected read-only endpoint',async()=>{
 const r=await probe('https://example.test/private?token=never',(url,options)=>{
  assert.equal(url.href,'https://example.test/api/odds-pulse');assert.equal(options.redirect,'error');return Promise.resolve({status:200,json:async()=>good})
 },now);
 assert.equal(r.pricedRows,1);
});
test('rejects embedded URL credentials',async()=>await assert.rejects(()=>probe('https://person:secret@example.test'),/Credentials/));
