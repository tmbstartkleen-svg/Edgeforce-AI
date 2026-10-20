import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateBetaReadiness} from '../src/lib/intelligence-core/beta-readiness.mjs';
test('previous beta gate evidence alone cannot certify a betting-intelligence beta',()=>{
 const all=evaluateBetaReadiness().gates.map(g=>g.id);
 const evidence=Object.fromEntries(all.filter(id=>!['independentOdds','modelCalibration','productionCommit','ingestionReadback'].includes(id)).map(id=>[id,true]));
 const r=evaluateBetaReadiness(evidence);
 assert.equal(r.ready,false);
 assert.deepEqual(r.missing,['independentOdds','modelCalibration','productionCommit','ingestionReadback']);
});
test('no string or claimed progress value substitutes for certification evidence',()=>{
 const r=evaluateBetaReadiness({independentOdds:'TRUSTED',modelCalibration:'planned',productionCommit:1,ingestionReadback:'ready'});
 assert.equal(r.ready,false);
});
