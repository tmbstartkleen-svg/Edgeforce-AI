import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/heldout-calibration-audit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {auditHeldOutProbabilityCalibration}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=Date.parse('2026-10-23T19:00:00Z');
const make=(i,probability=.6,result=i%2)=>({eventId:'e-'+i,marketId:'h2h',outcomeId:'home',
 modelId:'independent-test-model',modelVersion:'v1',forecastAt:new Date(now-3600000).toISOString(),
 settledAt:new Date(now-1000).toISOString(),probability,result});
test('held-out audit calculates actual Brier/log loss and bin calibration',()=>{
 const a=make(1,.7,1),b=make(2,.3,0);
 const r=auditHeldOutProbabilityCalibration([a,b],now);
 assert.equal(r.sampleSize,2);
 assert.ok(Math.abs(r.brierScore-.09)<1e-12);
 assert.ok(Math.abs(r.logLoss-(-Math.log(.7)))<1e-12);
 assert.ok(Math.abs(r.expectedCalibrationError-.3)<1e-12);
 assert.equal(r.certified,false);
 assert.equal(r.minimumSampleMet,false);
});
test('minimum sample is evidence not self-certification',()=>{
 const r=auditHeldOutProbabilityCalibration(Array.from({length:120},(_,i)=>make(i)),now);
 assert.equal(r.minimumSampleMet,true);
 assert.equal(r.sourceProvenanceVerified,false);
 assert.equal(r.holdoutPartitionVerified,false);
 assert.equal(r.certified,false);
});
test('reject lookahead forecasts, future settlements and duplicate labels',()=>{
 const a=make(1);
 const r=auditHeldOutProbabilityCalibration([a,a,{...make(2),forecastAt:new Date(now+500).toISOString()},
  {...make(3),settledAt:new Date(now+500).toISOString()}],now);
 assert.equal(r.sampleSize,1);
 assert.equal(r.rejected.DUPLICATE_SETTLEMENT,1);
 assert.equal(r.rejected.INVALID_TEMPORAL_ORDER,2);
});
test('separate models cannot be pooled to inflate calibration sample',()=>{
 const a=make(1);const b={...make(2),modelVersion:'v2'};
 const r=auditHeldOutProbabilityCalibration([a,b],now);
 assert.equal(r.sampleSize,1);
 assert.equal(r.rejected.MIXED_MODEL_VERSIONS,1);
});
test('invalid outcomes and unbounded batches fail closed',()=>{
 const a={...make(1),probability:1};
 const r=auditHeldOutProbabilityCalibration([a],now);
 assert.equal(r.sampleSize,0);
 assert.equal(r.brierScore,null);
 assert.equal(r.rejected.INVALID_SETTLEMENT,1);
 assert.throws(()=>auditHeldOutProbabilityCalibration([],now,21),/INVALID_CALIBRATION_BATCH/);
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|Math\.random/);
});
