import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/paired-brier-skill.ts',import.meta.url),'utf8');
const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {evaluatePairedBrierSkill}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const now=Date.parse('2026-10-23T20:00:00Z');
const example=(i,extra={})=>({eventId:'e'+i,marketId:'h2h',outcomeId:'home',
 forecastAt:'2026-10-21T15:00:00Z',settledAt:'2026-10-23T19:00:00Z',
 modelProbability:i%2?0.8:0.2,baselineProbability:0.5,result:i%2,...extra});
test('paired Brier skill beats a reference on matched outcomes, but remains uncertified',()=>{
 const a=evaluatePairedBrierSkill(Array.from({length:120},(_,i)=>example(i)),now);
 assert.equal(a.sampleSize,120);
 assert.equal(a.minimumSampleMet,true);
 assert.equal(a.observedImprovement,true);
 assert.ok(a.absoluteBrierImprovement>0);
 assert.equal(a.baselineBrierScore,0.25);
 assert.equal(a.certified,false);
 assert.equal(a.baselineProvenanceVerified,false);
});
test('duplicate and lookahead records do not inflate the effective sample',()=>{
 const a=example(1);
 const r=evaluatePairedBrierSkill([a,a,example(2,{settledAt:'2026-10-24T15:00:00Z'})],now);
 assert.equal(r.sampleSize,1);
 assert.equal(r.rejected.DUPLICATE_OUTCOME,1);
 assert.equal(r.rejected.INVALID_PAIRED_TIME,1);
});
test('bad model odds and a worse model fail closed',()=>{
 const worse=Array.from({length:120},(_,i)=>example(i,{modelProbability:i%2?.2:.8}));
 const report=evaluatePairedBrierSkill(worse,now);
 assert.equal(report.observedImprovement,false);
 const invalid=evaluatePairedBrierSkill([example(1,{modelProbability:1})],now);
 assert.equal(invalid.sampleSize,0);
 assert.equal(invalid.rejected.INVALID_PAIRED_RECORD,1);
 assert.throws(()=>evaluatePairedBrierSkill([],Infinity),/INVALID_PAIRED_BASELINE/);
});
test('metric never makes network calls or claims model certification',()=>{
 assert.doesNotMatch(raw,/fetch\(|Math\.random|INSERT INTO|writeFile/);
});
