import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const calibration=uri(compile('heldout-calibration-audit.ts'));
const clv=uri(compile('closing-line-value-audit.ts'));
const agreement=uri(compile('independent-quote-agreement.ts'));
const paired=uri(compile('paired-brier-skill.ts'));
const source=compile('stage2-evidence-dossier.ts')
 .replace("from './heldout-calibration-audit'","from "+JSON.stringify(calibration))
 .replace("from './closing-line-value-audit'","from "+JSON.stringify(clv))
 .replace("from './independent-quote-agreement'","from "+JSON.stringify(agreement))
 .replace("from './paired-brier-skill'","from "+JSON.stringify(paired));
const {evaluateStage2ResearchDossier}=await import(uri(source));
const now=Date.parse('2026-10-23T20:00:00Z');
const yesterday=new Date(now-24*3600000).toISOString(),today=new Date(now-60000).toISOString();
const settled=i=>({eventId:'settled-'+i,marketId:'h2h',outcomeId:'home',
 modelId:'independent-test',modelVersion:'1',forecastAt:yesterday,settledAt:today,
 probability:i%2?.48:.52,result:i%2});
const closing=i=>({eventId:'historical-'+i,marketType:'h2h',outcomeId:'home',bookmaker:'DraftKings',
 placedAmericanOdds:-110,closingAmericanOdds:-115,placedAt:yesterday,closedAt:new Date(now-3600000).toISOString(),
 startsAt:new Date(now-1800000).toISOString(),sourceUpstreamId:'feedA',closingUpstreamId:'feedA'});
const quote=(upstreamId)=>({upstreamId,bookmaker:'DraftKings',eventId:'future-1',marketType:'h2h',
 outcomeId:'home',americanOdds:-115,observedAt:new Date(now-30000).toISOString(),
 startsAt:new Date(now+3600000).toISOString()});
test('empty dossier is explicitly blocked with actionable evidence gaps',()=>{
 const r=evaluateStage2ResearchDossier({settledForecasts:[],closingLinePairs:[],simultaneousSourceQuotes:[]},now);
 assert.equal(r.stage2Certified,false);
 assert.equal(r.productionReady,false);
 assert.equal(r.verifiedBetCount,0);
 assert.ok(r.deficiencies.includes('SETTLED_MODEL_SAMPLE'));
 assert.ok(r.deficiencies.includes('MODEL_HOLDOUT_PROVENANCE'));
});
test('full synthetic metrics can never self-certify provenance or live bets',()=>{
 const r=evaluateStage2ResearchDossier({
  settledForecasts:Array.from({length:120},(_,i)=>settled(i)),
  closingLinePairs:Array.from({length:35},(_,i)=>closing(i)),
  simultaneousSourceQuotes:[quote('upstream-one'),quote('upstream-two')]
 },now);
 assert.equal(r.calibration.sampleSize,120);
 assert.equal(r.clv.comparablePairs,35);
 assert.equal(r.crossSource.corroboratedMarkets,1);
 assert.equal(r.stage2ResearchMetricsAvailable,true);
 assert.equal(r.stage2Certified,false);
 assert.equal(r.verifiedBetCount,0);
 assert.ok(r.deficiencies.includes('SOURCE_AUTHENTICITY_AND_ENTITLEMENT'));
 assert.ok(r.deficiencies.includes('BRIER_SKILL_BASELINE'));
 assert.ok(r.deficiencies.includes('LIVE_EXECUTABILITY'));
});
test('duplicated settlements and price pairs cannot meet minimum evidence threshold',()=>{
 const r=evaluateStage2ResearchDossier({
  settledForecasts:Array.from({length:120},()=>settled(1)),
  closingLinePairs:Array.from({length:35},()=>closing(1)),
  simultaneousSourceQuotes:[quote('one'),quote('one')]
 },now);
 assert.equal(r.calibration.sampleSize,1);
 assert.equal(r.clv.comparablePairs,1);
 assert.equal(r.crossSource.corroboratedMarkets,0);
 assert.equal(r.stage2ResearchMetricsAvailable,false);
});
test('invalid inputs and oversized underlying datasets fail closed',()=>{
 assert.throws(()=>evaluateStage2ResearchDossier({settledForecasts:[],closingLinePairs:[]},now),/INVALID_STAGE2_EVIDENCE/);
 assert.throws(()=>evaluateStage2ResearchDossier({
  settledForecasts:Array.from({length:50001},()=>settled(1)),
  closingLinePairs:[],simultaneousSourceQuotes:[]},now),/INVALID_CALIBRATION_BATCH/);
});
test('dossier cannot call providers or operate on persistent storage',()=>{
 assert.doesNotMatch(source,/fetch\(|INSERT INTO|Math\.random|D1Database|writeFile/);
});
