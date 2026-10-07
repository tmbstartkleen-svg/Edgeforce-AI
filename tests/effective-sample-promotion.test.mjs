import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ts=createRequire(import.meta.url)('typescript');
const source=read('src/lib/settlementLearning.ts');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const provider={settlementLearning:{schemaVersion:'v152-settlement-learning-1',evidenceClass:'PROVIDER_NATIVE',confidence:'PROVIDER_NATIVE',trainingEligible:true,evidenceWeight:1,legacy:false,reason:'fixture'}};
const medium={settlementLearning:{schemaVersion:'v152-settlement-learning-1',evidenceClass:'CORROBORATED_SCORE',confidence:'MEDIUM',trainingEligible:true,evidenceWeight:.75,legacy:false,reason:'fixture'}};

test('V154 effective evidence helper blocks raw-count inflation',()=>{
 const mediumRows=Array.from({length:100},()=>({features:medium}));
 const providerRows=Array.from({length:80},()=>({features:provider}));
 assert.equal(runtime.effectiveEvidenceSampleSize(mediumRows),75);
 assert.deepEqual(runtime.meetsEffectiveEvidenceMinimum(mediumRows,80),{ok:false,effectiveSampleSize:75,minimum:80});
 assert.deepEqual(runtime.meetsEffectiveEvidenceMinimum(providerRows,80),{ok:true,effectiveSampleSize:80,minimum:80});
});

test('V154 recalibration and validation promotion gates use effective depth',()=>{
 const recalibration=read('src/lib/recalibrationEngine.ts');
 const validation=read('src/lib/validationLab.ts');
 assert.match(recalibration,/if\(effectiveSampleSize<options\.minSample\)/);
 assert.match(recalibration,/holdoutEffectiveSampleSize<options\.minHoldout/);
 assert.match(validation,/const effectiveSample=metrics\.summary\.effectiveSampleSize/);
 assert.match(validation,/const effectiveHoldout=metrics\.holdout\.effectiveSampleSize/);
 assert.match(validation,/if\(effectiveSample<75\|\|effectiveHoldout<20/);
 assert.match(validation,/if\(effectiveSample>=200&&effectiveHoldout>=50/);
});

test('V154 governance and internal model promotion require effective evidence',()=>{
 const governance=read('src/lib/modelGovernance.ts');
 const trained=read('src/lib/trainedSportModels.ts');
 assert.match(governance,/recentEffectiveSampleSize<options\.minRecent\|\|baselineEffectiveSampleSize<options\.minBaseline/);
 assert.match(governance,/baselineEffectiveSampleSize/);
 assert.match(governance,/recentEffectiveSampleSize/);
 assert.match(trained,/const enough=effectiveSampleSize>=minSample&&holdoutEffectiveSampleSize>=minHoldout/);
 assert.match(trained,/effectiveEvidenceSampleSize\(g\.list\)>=/);
});

test('V154 external ML group and service promotion gates fail closed on effective depth',()=>{
 const tournament=read('src/lib/externalMlTournament.ts');
 const service=read('ml-service/app.py');
 assert.match(tournament,/effectiveEvidenceSampleSize\(g\.list\)>=/);
 assert.match(tournament,/Candidate effective evidence depth/);
 assert.match(tournament,/Candidate effective holdout depth/);
 assert.match(service,/if effective_sample_size < MIN_SAMPLE:/);
 assert.match(service,/if holdout_effective_sample_size < MIN_HOLDOUT/);
});
