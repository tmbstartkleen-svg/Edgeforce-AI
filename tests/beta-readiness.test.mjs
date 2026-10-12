import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBetaReadiness} from '../src/lib/intelligence-core/beta-readiness.mjs';
test('read-only D1 success alone never certifies market readiness',()=>{
 const x=evaluateBetaReadiness({d1Deployment:true,d1Persistence:true,agentTaskSchema:true});
 assert.equal(x.ready,false);assert.equal(x.status,'NOT_BETA_READY');
 assert.ok(x.missing.includes('liveCollectors')&&x.missing.includes('nonSportsContracts'));
});
test('all required evidence can certify beta',()=>{
 const keys=evaluateBetaReadiness().gates.map(x=>x.id);
 assert.equal(evaluateBetaReadiness(Object.fromEntries(keys.map(k=>[k,true]))).ready,true);
});
test('unknown evidence and unchecked promises cannot pass gates',()=>{
 assert.equal(evaluateBetaReadiness({sportsObservations:'soon',dashboard:1}).ready,false);
});
