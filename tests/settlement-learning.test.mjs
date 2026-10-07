import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/settlementLearning.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

test('V152 provider-native and corroborated results are learning eligible',()=>{
 const provider=runtime.settlementLearningPolicy({evidenceClass:'PROVIDER_NATIVE',confidence:'PROVIDER_NATIVE'});
 assert.equal(provider.trainingEligible,true);
 assert.equal(provider.evidenceWeight,1);

 const high=runtime.settlementLearningPolicy({evidenceClass:'CORROBORATED_SCORE',confidence:'HIGH'});
 assert.equal(high.trainingEligible,true);
 assert.equal(high.evidenceWeight,1);

 const medium=runtime.settlementLearningPolicy({evidenceClass:'CORROBORATED_SCORE',confidence:'MEDIUM'});
 assert.equal(medium.trainingEligible,true);
 assert.equal(medium.evidenceWeight,.75);
});

test('V152 trusted single-source settlement is excluded from automatic learning',()=>{
 const single=runtime.settlementLearningPolicy({evidenceClass:'TRUSTED_PRIMARY_SINGLE',confidence:'SINGLE_SOURCE'});
 assert.equal(single.trainingEligible,false);
 assert.equal(single.evidenceWeight,.35);
 assert.match(single.reason,/excluded from automatic model promotion/i);

 const unknown=runtime.settlementLearningPolicy({evidenceClass:'UNKNOWN',confidence:'UNKNOWN'});
 assert.equal(unknown.trainingEligible,false);
 assert.equal(unknown.evidenceWeight,0);
});

test('V152 legacy history remains eligible for backward-compatible learning',()=>{
 const legacy=runtime.settlementLearningPolicy(null);
 assert.equal(legacy.trainingEligible,true);
 assert.equal(legacy.legacy,true);
 assert.equal(legacy.evidenceClass,'LEGACY_UNVERIFIED');
 assert.equal(legacy.evidenceWeight,.5);
});

test('V152 stored learning policy is read from historical prediction features',()=>{
 const policy=runtime.settlementLearningFromFeatures({
  settlementLearning:{
   evidenceClass:'TRUSTED_PRIMARY_SINGLE',
   confidence:'SINGLE_SOURCE',
   trainingEligible:false,
   evidenceWeight:.35,
   legacy:false,
   reason:'fixture'
  }
 });
 assert.equal(policy.trainingEligible,false);
 assert.equal(policy.evidenceClass,'TRUSTED_PRIMARY_SINGLE');
});

test('V152 all core prediction-learning paths enforce settlement eligibility',()=>{
 const paths=[
  '../src/lib/recalibrationEngine.ts',
  '../src/lib/modelGovernance.ts',
  '../src/lib/validationLab.ts',
  '../src/lib/trainedSportModels.ts',
  '../src/lib/externalMlTournament.ts'
 ];
 for(const path of paths){
  const body=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(body,/settlementLearningFromFeatures/);
  assert.match(body,/trainingEligible/);
 }
});

test('V152 prediction feedback persists provenance and learning policy',()=>{
 const body=readFileSync(new URL('../src/lib/predictionFeedback.ts',import.meta.url),'utf8');
 assert.match(body,/settlementProvenance:result\.settlementProvenance\|\|null/);
 assert.match(body,/settlementLearningPolicy\(result\.settlementProvenance\)/);
 assert.match(body,/settlementLearning/);
});
