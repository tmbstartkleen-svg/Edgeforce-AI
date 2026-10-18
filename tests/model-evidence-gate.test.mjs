import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/modelEvidenceGate.ts',import.meta.url),'utf8');
const moduleText=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=new URL('../src/lib/edgeValue.ts',import.meta.url);
const edgeText=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const edgeUrl='data:text/javascript;base64,'+Buffer.from(edgeText).toString('base64');
const sourceUrl='data:text/javascript;base64,'+Buffer.from(moduleText.replace(/from ['"]\.\/edgeValue['"]/g,'from '+JSON.stringify(edgeUrl))).toString('base64');
const {evaluateModelEvidence}=await import(sourceUrl);
const now='2026-10-17T22:00:00Z';
const good=()=>({probability:.571,modelId:'soccer-xg',modelVersion:'v1',trainedThrough:'2026-10-16T20:00:00Z',generatedAt:'2026-10-17T21:00:00Z',independentOfTargetBook:true,outOfSampleSettledCount:300,outOfSampleBrierScore:.21,features:[{name:'xG',source:'licensed-match-feed',observedAt:'2026-10-17T20:00:00Z'}]});
test('evidence-ready still is not a verified profitable pick',()=>{
 const value=evaluateModelEvidence(-117,good(),now);
 assert.equal(value.status,'EVIDENCE_READY');
 assert.ok(Math.abs(value.edgePp-3.1829493)<.001);
});
test('market-derived probabilities are excluded from evidence-ready predictions',()=>{
 const value=evaluateModelEvidence(-117,{...good(),independentOfTargetBook:false},now);
 assert.equal(value.status,'RESEARCH_ONLY');assert.ok(value.reasons.includes('NOT_INDEPENDENT_OF_TARGET_PRICE'));
});
test('stale features, missing calibration and little history fail closed',()=>{
 const evidence=good();evidence.features[0].observedAt='2026-09-01T10:00:00Z';evidence.outOfSampleSettledCount=4;evidence.outOfSampleBrierScore=null;
 const value=evaluateModelEvidence(-117,evidence,now);
 assert.equal(value.status,'RESEARCH_ONLY');assert.equal(value.reasons.length,3);
});
