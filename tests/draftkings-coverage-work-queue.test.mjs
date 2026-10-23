import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const coverage=uri(compile('draftkings-market-gap-audit.ts'));
const full=uri(compile('full-draftkings-export-audit.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(coverage)));
const continuity=uri(compile('draftkings-coverage-continuity.ts')
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(coverage)));
const work=compile('draftkings-coverage-work-queue.ts')
 .replace("from './full-draftkings-export-audit'","from "+JSON.stringify(full))
 .replace("from './draftkings-coverage-continuity'","from "+JSON.stringify(continuity));
const {buildDraftKingsCoverageWorkQueue}=await import(uri(work));
const now=Date.parse('2026-10-23T20:00:00Z');
const expected=[
 {sport:'basketball_nba',league:'NBA',marketType:'player_points',kind:'player-prop',eventId:'e2',playerId:'athlete-1',line:'22.5'},
 {sport:'soccer_epl',league:'Premier League',marketType:'h2h',kind:'game',eventId:'e1'},
 {sport:'tennis_atp',league:'ATP',marketType:'h2h',kind:'game',eventId:'e3'}
];
test('unpriced exact player props receive P1 priority and a specific verification action',()=>{
 const result=buildDraftKingsCoverageWorkQueue([],expected,[],now);
 assert.equal(result.queueCount,3);
 assert.equal(result.rows[0].priority,'P1');
 assert.equal(result.rows[0].owner,'PLAYER_IDENTITY_AND_PROPS');
 assert.equal(result.verifiedBets,0);
 assert.equal(result.releaseCertified,false);
 assert.equal(result.byPriority.P1,1);
});
test('persistent missed games are prioritized ahead of intermittent missed games',()=>{
 const quote=(at)=>({sport:'soccer_epl',league:'Premier League',marketType:'h2h',eventId:'e1',
  bookmaker:'DraftKings',sourceUpstreamId:'odds-a',outcomeId:'Home',americanOdds:-120,
  startsAt:'2026-10-23T23:00:00Z',observedAt:new Date(Date.parse(at)-1000).toISOString()});
 const history=[
  {asOf:'2026-10-23T18:00:00Z',sourceId:'provider-a',quotes:[quote('2026-10-23T18:00:00Z')]},
  {asOf:'2026-10-23T18:20:00Z',sourceId:'provider-a',quotes:[]}
 ];
 const report=buildDraftKingsCoverageWorkQueue([],expected,history,now);
 assert.equal(report.historySnapshots,2);
 assert.equal(report.persistentMissing,2);
 assert.equal(report.intermittentMissing,1);
 assert.equal(report.rows.filter(x=>x.priority==='P1').length,2);
});
test('empty catalog yields no tasks, never a completed release',()=>{
 const r=buildDraftKingsCoverageWorkQueue([],[],[],now);
 assert.equal(r.queueCount,0);assert.equal(r.readyForProduction,false);
});
test('strictly capped response and wholly local calculation',()=>{
 const r=buildDraftKingsCoverageWorkQueue([],expected,[],now,1);
 assert.equal(r.displayedCount,1);assert.equal(r.truncated,true);
 assert.throws(()=>buildDraftKingsCoverageWorkQueue([],expected,[],now,0),/INVALID_GAP_WORK_QUEUE/);
 assert.doesNotMatch(work,/fetch\(|INSERT INTO|Math\.random|writeFile/);
});
