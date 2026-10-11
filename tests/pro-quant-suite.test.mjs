import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/proQuant.ts',import.meta.url),'utf8');
const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(result.diagnostics?.length||0,0);
const {impliedProbability,americanOdds,twoWayNoVig,expectedValue,priceResearch,betProfit,summarizeBets,summarizeEpa}=await import('data:text/javascript,'+encodeURIComponent(result.outputText));
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('V203 American odds, no-vig probability and sportsbook hold use executable math',()=>{
 assert.equal(impliedProbability(-110),110/210);
 assert.equal(impliedProbability(100),.5);
 assert.equal(impliedProbability(50),null);
 assert.equal(impliedProbability(Number.NaN),null);
 assert.equal(impliedProbability(-99),null);
 assert.equal(americanOdds(.5),-100);
 const fair=twoWayNoVig(-110,-110);
 assert.ok(fair);
 assert.ok(Math.abs(fair.a-.5)<1e-10);
 assert.ok(Math.abs(fair.hold-(220/210-1))<1e-10);
 assert.equal(twoWayNoVig(+9999,+9999),null);
 assert.equal(expectedValue(.6,+120),.32);
});
test('V203 manual reference values cannot claim verified execution without independent books and recent quote',()=>{
 const base={referenceA:-110,referenceB:-110,offered:+120,estimate:.6,books:2,quoteAgeMin:1};
 assert.equal(priceResearch(base).status,'REVIEW_PRICE');
 assert.equal(priceResearch({...base,books:1}).status,'RESEARCH_ONLY');
 assert.equal(priceResearch({...base,quoteAgeMin:12}).status,'RESEARCH_ONLY');
 assert.equal(priceResearch({...base,offered:-220}).status,'RESEARCH_ONLY');
 assert.equal(priceResearch({...base,estimate:null}).status,'RESEARCH_ONLY');
 assert.equal(priceResearch({...base,referenceB:0}).status,'RESEARCH_ONLY');
});
test('V203 settled returns, CLV and win-rate exclude open and pushed bets where appropriate',()=>{
 const rows=[
  {id:'1',date:'2026-10-01',sport:'NFL',selection:'A',book:'B',stake:100,odds:120,closingOdds:100,result:'WIN'},
  {id:'2',date:'2026-10-01',sport:'NFL',selection:'B',book:'B',stake:50,odds:-110,closingOdds:-130,result:'LOSS'},
  {id:'3',date:'2026-10-01',sport:'NFL',selection:'C',book:'B',stake:30,odds:110,closingOdds:null,result:'PUSH'},
  {id:'4',date:'2026-10-01',sport:'NFL',selection:'D',book:'B',stake:40,odds:-120,closingOdds:null,result:'OPEN'}
 ];
 assert.equal(betProfit(rows[0]),120);
 const summary=summarizeBets(rows);
 assert.equal(summary.settled,3);
 assert.equal(summary.open,1);
 assert.equal(summary.stake,180);
 assert.equal(summary.profit,70);
 assert.ok(Math.abs(summary.roi-70/180)<1e-10);
 assert.equal(summary.winRate,.5);
 assert.equal(summary.clvCount,2);
 assert.equal(summarizeBets([]).roi,null);
});
test('V203 historical NFL EPA is descriptive, filters anomalies and counts valid plays',()=>{
 const plays=[
  ...Array.from({length:4},(_,i)=>({posteam:'BUF',epa:i%2===0?1:-.5,play_type:i===0?'run':'pass',success:i%2})),
  {posteam:'MIA',epa:2,play_type:'run',success:1},
  {posteam:'BAD HTML',epa:1,play_type:'pass',success:1},
  {posteam:'BUF',epa:999,play_type:'pass',success:1}
 ];
 const results=summarizeEpa(plays);
 assert.equal(results.length,1);
 assert.equal(results[0].plays,4);
 assert.equal(results[0].status,'HISTORICAL_DESCRIPTIVE');
 assert.ok(Math.abs(results[0].epaPerPlay-.25)<1e-10);
 assert.equal(results[0].passShare,.75);
});
test('V203 mandatory integration and operator safeguards are wired into separate research workspace',()=>{
 const panel=read('../src/components/ProQuantSuite.tsx');
 const dashboard=read('../src/components/Dashboard.tsx');
 const cfg=read('../src/lib/proIntegrations.ts');
 const api=read('../src/app/api/pro/analyst/route.ts');
 const links=read('../src/app/api/pro/integrations/route.ts');
 assert.match(dashboard,/href="#pro-quant"/);
 assert.match(dashboard,/ProQuantSuite/);
 assert.match(panel,/Price & \+EV Lab/);
 assert.match(panel,/Bankroll \/ CLV/);
 assert.match(panel,/NFL Play-by-play EPA/);
 assert.match(panel,/Data & Partners/);
 assert.match(panel,/type="password"/);
 assert.match(panel,/No upload or database write/);
 assert.match(cfg,/LICENSE_REQUIRED/);
 assert.match(cfg,/DraftKings/);
 assert.match(cfg,/FanDuel/);
 assert.match(cfg,/Kalshi/);
 assert.match(cfg,/Polymarket/);
 assert.match(api,/timingSafeEqual/);
 assert.match(api,/reserveAnalystCall/);
 assert.match(api,/used>=12/);
 assert.match(api,/AUTHORIZATION|authorization/);
 assert.match(api,/https:\/\/ai-gateway.vercel.sh\/v1\/chat\/completions/);
 assert.match(api,/MANUALLY_ENTERED_UNVERIFIED/);
 assert.match(links,/proIntegrations/);
});
