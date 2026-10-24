import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const mapper=uri(compile('the-odds-api-d1-preparation.ts'));
const gap=uri(compile('draftkings-market-gap-audit.ts'));
const js=compile('odds-api-draftkings-gap-preflight.ts')
 .replace("from './the-odds-api-d1-preparation'","from "+JSON.stringify(mapper))
 .replace("from './draftkings-market-gap-audit'","from "+JSON.stringify(gap));
const {auditTheOddsApiDraftKingsGaps}=await import(uri(js));
const now=Date.parse('2026-10-23T20:00:00Z');
const event=(markets)=>[{id:'evt-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(now+7200000).toISOString(),bookmakers:[{key:'draftkings',title:'DraftKings',
 last_update:new Date(now-20000).toISOString(),markets}]}];
const market=(key,outcomes)=>({key,outcomes});
const outcome=(name,price=-110,point=undefined,description=undefined)=>({name,price,...(point===undefined?{}:{point}),...(description===undefined?{}:{description})});
const req=(extra={})=>({sport:'basketball_nba',league:'NBA',marketType:'h2h',kind:'game',eventId:'evt-1',...extra});
test('live-priced provider sample maps to explicit catalog with remaining external approval blockers',()=>{
 const r=auditTheOddsApiDraftKingsGaps(event([market('h2h',[outcome('Home'),outcome('Away',100)])]),[req()],now);
 assert.equal(r.coveredCount,1);assert.equal(r.sampleTruncated,false);
 assert.equal(r.catalogExternallyAuthenticated,false);
 assert.equal(r.releaseCertified,false);
});
test('25 priced outcome cap cannot imply full DraftKings coverage',()=>{
 const outcomes=Array.from({length:30},(_,i)=>outcome('Home'+i));
 const r=auditTheOddsApiDraftKingsGaps(event([market('h2h',outcomes)]),[req()],now);
 assert.equal(r.sampleTruncated,true);assert.equal(r.coverageComplete,false);
 assert.equal(r.preparedQuotes,25);
});
test('name-only player IDs remain unverified and cannot pass exact player prop requirement',()=>{
 const prop=market('player_points',[outcome('Over',-115,22.5,'Example Player')]);
 const requirement=req({marketType:'player_points',kind:'player-prop',playerId:'athlete-100',line:'22.5'});
 const r=auditTheOddsApiDraftKingsGaps(event([prop]),[requirement],now,true);
 assert.equal(r.coveredCount,0);assert.ok(r.provisionalPlayerProps>0);
});
test('event and player-specific alternatives cannot borrow generic market coverage',()=>{
 const r=auditTheOddsApiDraftKingsGaps(event([market('h2h',[outcome('Home')])]),
  [req({eventId:'evt-2'})],now);
 assert.equal(r.coveredCount,0);
});
