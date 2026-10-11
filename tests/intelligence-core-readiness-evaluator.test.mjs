import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateIntelligenceReadiness} from '../src/lib/intelligence-core/readiness-evaluator.mjs';
const now=2_000_000;
const baseline={schemaReady:true,approvedProviders:1,observationCount:2,
 latestObservationMs:now-1000,lastSuccessfulRunMs:now-1000,
 failedRuns:0,stuckRuns:0,coreEnabled:true,mirrorEnabled:true,now};
test('readiness requires persisted fresh evidence',()=>{
 assert.equal(evaluateIntelligenceReadiness(baseline).runtimeHealthy,true);
 assert.ok(evaluateIntelligenceReadiness({...baseline,observationCount:0}).blockers.includes('NO_PERSISTED_OBSERVATIONS'));
 assert.ok(evaluateIntelligenceReadiness({...baseline,latestObservationMs:now-1000000}).blockers.includes('NO_FRESH_OBSERVATIONS'));
});
test('expired agent leases and excessive failures block activation',()=>{
 assert.ok(evaluateIntelligenceReadiness({...baseline,stuckRuns:1}).blockers.includes('EXPIRED_AGENT_LEASES'));
 assert.ok(evaluateIntelligenceReadiness({...baseline,failedRuns:11}).blockers.includes('EXCESSIVE_AGENT_FAILURES'));
});
test('registered providers alone are insufficient evidence of live operation',()=>{
 const x=evaluateIntelligenceReadiness({...baseline,coreEnabled:false,lastSuccessfulRunMs:null});
 assert.equal(x.runtimeHealthy,false);
 assert.equal(x.mode,'DISABLED');
});
