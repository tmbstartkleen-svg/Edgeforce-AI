import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const source=read('../src/lib/providers/serpGoogleSports.ts');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.length||0,0);
const {configuredSerpSportsTargets,parseSerpGoogleSports,requestSerpGoogleSports}=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));
const target={id:'laliga',name:'La Liga',kgmid:'/m/09gqx',sp:'ft'};
const payload={
 search_metadata:{status:'Success',created_at:'2026-05-25 11:44:24 UTC'},
 league_results:{game_groups:[{title:'Round',games:[{
  kgmid:'/g/11yfm_r2dp',start_time:'2026-05-17T17:00:00Z',
  status:'finished',status_original:'FT',league:{name:'LALIGA'},
  teams:[{name:'Real Sociedad',score:3},{name:'Valencia CF',score:4}]
 }]}]}
};
test('V200 mirrors SerpApi league fixture without inventing home-away position',()=>{
 const result=parseSerpGoogleSports(payload,target);
 assert.equal(result.warning,undefined);
 assert.equal(result.games.length,1);
 assert.equal(result.games[0].status,'FINAL');
 assert.deepEqual(result.games[0].teamA,{name:'Real Sociedad',score:3});
 assert.deepEqual(result.games[0].teamB,{name:'Valencia CF',score:4});
 assert.equal(result.games[0].homeAwayConfirmed,false);
 assert.equal(result.observedAt,'2026-05-25T11:44:24.000Z');
});
test('V200 refuses failed or incomplete upstream data',()=>{
 assert.equal(parseSerpGoogleSports({...payload,search_metadata:{status:'Error'}},target).games.length,0);
 assert.equal(parseSerpGoogleSports({...payload,search_metadata:{status:'Processing'}},target).games.length,0);
 assert.equal(parseSerpGoogleSports({...payload,search_metadata:{status:'Success'}},target).games.length,0);
});
test('V200 rejects unsupported targets, duplicate identifiers and wrong game identities',()=>{
 const targets=configuredSerpSportsTargets({SERPAPI_SPORTS_TARGETS_JSON:JSON.stringify([
  {id:'laliga',name:'La Liga',kgmid:'/m/09gqx',sp:'ft'},
  {id:'laliga',name:'Duplicate',kgmid:'/m/09gqx',sp:'ft'},
  {id:'mal',name:'Offsite',kgmid:'https://somewhere.com',sp:'ft'},
  {id:'bad',name:'Bad',kgmid:'/m/09gqx',sp:'other'}
 ])});
 assert.equal(targets.length,1);
 const invalid={...payload,league_results:{game_groups:[{games:[{
  kgmid:'not-a-kgmid',start_time:'2026-05-17T17:00:00Z',status:'finished',
  teams:[{name:'A'},{name:'B'}]
 }]}]}};
 assert.equal(parseSerpGoogleSports(invalid,target).games.length,0);
});
test('V200 only requests real documented SerpApi Google Sports league params',async()=>{
 let calls=0;
 const fake=async raw=>{
  calls++;
  const url=new URL(raw);
  assert.equal(url.host,'serpapi.com');
  assert.equal(url.searchParams.get('engine'),'google_sports');
  assert.equal(url.searchParams.get('kgmid'),'/m/09gqx');
  assert.equal(url.searchParams.get('sp'),'ft');
  assert.equal(url.searchParams.get('type'),'league');
  assert.equal(url.searchParams.get('tab'),'gm');
  assert.equal(url.searchParams.get('no_cache'),'false');
  assert.equal(url.searchParams.get('api_key'),'test-placeholder');
  return new Response(JSON.stringify(payload),{headers:{'content-type':'application/json'}});
 };
 const result=await requestSerpGoogleSports('test-placeholder',target,fake);
 assert.equal(calls,1);
 assert.equal(result.games.length,1);
});
test('V200 shared quota and app remain strictly research-only and opt-in',()=>{
 const lease=read('../src/lib/providers/sharedSerpSportsBudget.ts');
 const route=read('../src/app/api/research/google-sports/route.ts');
 const panel=read('../src/components/GoogleSportsResearch.tsx');
 const games=read('../src/components/GamesWorkspace.tsx');
 assert.match(lease,/SERP_GOOGLE_RESEARCH_INTERVAL_MS=8\*60\*60\*1000/);
 assert.match(lease,/SERP_GOOGLE_MAX_MONTHLY=90/);
 assert.match(lease,/used_in_month=/);
 assert.match(lease,/for update/);
 assert.match(lease,/if\(!sql\)throw new Error/);
 assert.match(route,/SERPAPI_SPORTS_ENABLED==='true'/);
 assert.match(route,/dataRole:'SCHEDULE_RESEARCH_ONLY'/);
 assert.match(route,/oddsProvider:false,liveScoreSource:false/);
 assert.match(route,/acquireSerpSportsLease/);
 assert.match(route,/SHARED_BUDGET_UNAVAILABLE/);
 assert.match(games,/GoogleSportsResearch/);
 assert.match(panel,/Load Google Sports research/);
 assert.doesNotMatch(panel,/setInterval/);
 assert.doesNotMatch(read('../src/lib/providers/odds.ts'),/serpapi-google-sports/);
});
