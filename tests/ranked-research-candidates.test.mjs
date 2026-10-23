import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>ts.transpileModule(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const math='data:text/javascript;base64,'+Buffer.from(read('src/lib/firstPartyMarketMath.ts')).toString('base64');
const compiled=read('src/lib/ranked-research-candidates.ts').replaceAll("from './firstPartyMarketMath'","from "+JSON.stringify(math));
const {rankResearchCandidates}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now='2026-10-23T12:00:00.000Z';
const base={id:'a',sport:'Soccer',league:'EPL',eventId:'e',marketType:'h2h',outcomeId:'home',bookmaker:'DraftKings',
 americanOdds:150,quoteObservedAt:now,startsAt:'2026-10-23T14:00:00.000Z',
 modelProbability:.45,modelId:'candidate-model',modelEvidenceRef:'not-independently-checked',
 upstreamOwner:'upstream-one'};
test('research-only ranking sorts gross expected ROI without labeling verified picks',()=>{
 const rows=rankResearchCandidates([{...base,id:'b',eventId:'different',americanOdds:120},{...base}],now);
 assert.equal(rows.length,2);
 assert.equal(rows[0].id,'a');
 assert.ok(Math.abs(rows[0].edgeProbabilityPoints-5)<1e-9);
 assert.equal(rows[0].status,'RESEARCH_ONLY');
 assert.ok(rows[0].reasons.includes('MODEL_AND_EXECUTION_UNCERTIFIED'));
});
test('missing source provenance and started events fail closed',()=>{
 const [row]=rankResearchCandidates([{...base,upstreamOwner:'',startsAt:'2026-10-23T11:00:00.000Z'}],now);
 assert.ok(row.reasons.includes('MISSING_PROVENANCE'));
 assert.ok(row.reasons.includes('EVENT_STARTED_OR_INVALID'));
});
test('stale quote is not assigned a fresh ROI and duplicate identities collapse',()=>{
 const rows=rankResearchCandidates([{...base,quoteObservedAt:'2026-10-22T12:00:00.000Z'},{...base,id:'duplicate'}],now);
 assert.equal(rows.length,1);
 assert.equal(rows[0].grossExpectedRoi,null);
 assert.ok(rows[0].reasons.includes('STALE_OR_INVALID_PRICE'));
});
test('bounded input avoids unbounded operator loads',()=>{
 assert.throws(()=>rankResearchCandidates([base],now,501),/INVALID_RANK_LIMIT/);
});
