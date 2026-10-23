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
const stage2=uri(compile('stage2-evidence-dossier.ts')
 .replace("from './heldout-calibration-audit'","from "+JSON.stringify(calibration))
 .replace("from './closing-line-value-audit'","from "+JSON.stringify(clv))
 .replace("from './independent-quote-agreement'","from "+JSON.stringify(agreement))
 .replace("from './paired-brier-skill'","from "+JSON.stringify(paired)));
const coverage=uri(compile('draftkings-market-gap-audit.ts'));
const full=uri(compile('full-draftkings-export-audit.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(coverage)));
const continuity=uri(compile('draftkings-coverage-continuity.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(coverage)));
const source=compile('major-release-evidence-gate.ts')
 .replace("from './stage2-evidence-dossier'","from "+JSON.stringify(stage2))
 .replace("from './full-draftkings-export-audit'","from "+JSON.stringify(full))
 .replace("from './draftkings-coverage-continuity'","from "+JSON.stringify(continuity));
const {evaluateMajorReleaseEvidence}=await import(uri(source));
const now=Date.parse('2026-10-23T20:00:00Z');
const empty={stage2:{settledForecasts:[],closingLinePairs:[],simultaneousSourceQuotes:[]},
 draftKings:{events:[],expected:[]}};
test('integrated gate enumerates all 4 stages with no fabricated approvals',()=>{
 const r=evaluateMajorReleaseEvidence(empty,now);
 assert.equal(r.remainingMajorStages,4);
 assert.equal(r.certifiedStages,0);
 assert.equal(r.verifiedValueBets,0);
 assert.equal(r.releaseCertified,false);
 assert.equal(r.missingByStage.length,4);
 assert.equal(r.gateCount,10);
 assert.equal(r.stage3Coverage.coveragePercent,null);
});
test('a caller-provided complete market sample is research only, not certified',()=>{
 const data={...empty,draftKings:{
  expected:[{sport:'soccer_epl',league:'Premier League',marketType:'h2h',kind:'game'}],
  events:[{id:'match-1',sport_key:'soccer_epl',sport_title:'Premier League',
   commence_time:new Date(now+3600000).toISOString(),bookmakers:[{
    key:'draftkings',last_update:new Date(now-30000).toISOString(),
    markets:[{key:'h2h',outcomes:[{name:'Home',price:-120}]}]}]}]}};
 const r=evaluateMajorReleaseEvidence(data,now);
 assert.equal(r.stage3Coverage.coveredCount,1);
 assert.equal(r.stage3Coverage.coverageComplete,true);
 assert.equal(r.certifiedStages,0);
 assert.equal(r.productionApproved,false);
 assert.ok(r.missingByStage[2].researchOnly.includes('STAGE3_PRICED_OUTCOME_COVERAGE'));
 assert.ok(r.missingByStage[2].blocked.includes('STAGE3_PLAYER_IDENTITY'));
});
test('large invalid provider exports and incomplete dossier fail closed',()=>{
 assert.throws(()=>evaluateMajorReleaseEvidence({},now),/INVALID_MAJOR_RELEASE_EVIDENCE/);
 assert.throws(()=>evaluateMajorReleaseEvidence({...empty,draftKings:{events:{},expected:[]}},now),
 /INVALID_FULL_CATALOG_EXPORT/);
 assert.throws(()=>evaluateMajorReleaseEvidence(empty,Infinity),/INVALID_MAJOR_RELEASE_EVIDENCE/);
});
test('integrated release gate cannot write production data or access providers',()=>{
 assert.doesNotMatch(source,/fetch\(|INSERT INTO|writeFile\(|process\.env/);
});

test('Stage 3 multi-snapshot evidence flows into release blockers without approving production',()=>{
 const requirement={sport:'soccer',league:'Premier League',marketType:'h2h',kind:'game',eventId:'fixture-1'};
 const stamps=['2026-10-23T18:00:00Z','2026-10-23T18:20:00Z'];
 const snapshots=stamps.map(asOf=>({asOf,sourceId:'export-source',
  quotes:[{sport:'soccer',league:'Premier League',marketType:'h2h',eventId:'fixture-1',
   bookmaker:'DraftKings',sourceUpstreamId:'upstream-one',outcomeId:'home',americanOdds:-110,
   observedAt:new Date(Date.parse(asOf)-1000).toISOString(),startsAt:'2026-10-23T22:00:00Z'}]}));
 const report=evaluateMajorReleaseEvidence({...empty,draftKings:{
  events:[],expected:[requirement],snapshots
 }},now);
 assert.equal(report.stage3Continuity.snapshotCount,2);
 assert.equal(report.stage3Continuity.latestMissingCount,0);
 assert.equal(report.certifiedStages,0);
 assert.equal(report.productionApproved,false);
 assert.ok(report.missingByStage[2].researchOnly.includes('STAGE3_COVERAGE_CONTINUITY'));
 assert.ok(report.missingByStage[2].blocked.includes('STAGE3_PLAYER_IDENTITY'));
});
test('out-of-order historical coverage evidence cannot make release gate appear ready',()=>{
 const snapshots=[{asOf:'2026-10-23T18:20:00Z',sourceId:'one',quotes:[]},
  {asOf:'2026-10-23T18:00:00Z',sourceId:'one',quotes:[]}];
 assert.throws(()=>evaluateMajorReleaseEvidence({...empty,draftKings:{
  events:[],expected:[],snapshots
 }},now),/INVALID_CONTINUITY_TIME_SEQUENCE/);
});
