import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/first-party-calibration.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {evaluateCalibration}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now='2026-10-23T15:00:00.000Z';
const forecast=(i,probability,result,modelId='model-v1')=>({forecastId:'f'+i,eventId:'e'+i,marketKey:'moneyline-home',modelId,
 predictedAt:'2026-10-20T12:00:00.000Z',settledAt:'2026-10-21T12:00:00.000Z',probability,result});
test('binary Brier and log-loss are computed only from settled outcomes',()=>{
 const out=evaluateCalibration([forecast(1,.8,1),forecast(2,.2,0)],now,2);
 assert.equal(out.accepted,2);assert.equal(out.certified,false);
 assert.ok(Math.abs(out.models[0].brier-.04)<1e-12);
 assert.ok(Math.abs(out.models[0].logLoss-(-Math.log(.8)))<1e-12);
 assert.equal(out.models[0].status,'REVIEW_REQUIRED');
 assert.equal(out.models[0].bins.reduce((n,b)=>n+b.count,0),2);
});
test('models remain separate and small samples cannot be treated as adequate',()=>{
 const out=evaluateCalibration([forecast(1,.8,1),forecast(2,.2,0,'model-v2')],now,2);
 assert.equal(out.models.length,2);
 assert.ok(out.models.every(m=>m.status==='INSUFFICIENT_SAMPLE'));
});
test('future settlements, duplicate identities and invalid probabilities are rejected',()=>{
 const out=evaluateCalibration([forecast(1,.8,1),forecast(1,.8,1),{...forecast(2,.4,0),settledAt:'2026-10-24T12:00:00Z'},forecast(3,1,1)],now);
 assert.equal(out.accepted,1);assert.equal(out.rejected,3);
 assert.equal(out.rejectionReasons.DUPLICATE_FORECAST_ID,1);
 assert.equal(out.rejectionReasons.INVALID_TIMELINE,1);
 assert.equal(out.rejectionReasons.INVALID_OUTCOME,1);
});
test('no synthetic certification from a large volume of caller supplied results',()=>{
 const data=Array.from({length:40},(_,i)=>forecast(i,.6,i%2));
 const out=evaluateCalibration(data,now);
 assert.equal(out.models[0].status,'REVIEW_REQUIRED');
 assert.equal(out.certified,false);
});
