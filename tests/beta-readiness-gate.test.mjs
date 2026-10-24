import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBetaReadiness} from '../src/lib/intelligence-core/beta-readiness-gate.mjs';
test('missing release evidence always blocks certification',()=>{
 const result=evaluateBetaReadiness({exactMainCi:true});
 assert.equal(result.status,'NOT_CERTIFIED');assert.equal(result.passed,1);
 assert.ok(result.blockers.includes('independentUpstreamsVerified'));
 assert.equal(result.productionCutoverAuthorized,false);
});
test('only an explicitly supplied complete evidence record can reach review readiness',()=>{
 const keys=evaluateBetaReadiness().checks.map(c=>c.key);
 const result=evaluateBetaReadiness(Object.fromEntries(keys.map(k=>[k,true])));
 assert.equal(result.status,'READY_FOR_LIMITED_BETA_REVIEW');
 assert.equal(result.blockers.length,0);assert.equal(result.productionCutoverAuthorized,false);
});
