import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
async function runtime(path,replacements=[]){
 let source=readFileSync(new URL(path,import.meta.url),'utf8').replace(/import type .*?;\n/g,'');
 for(const [a,b] of replacements)source=source.replace(a,b);
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript,'+encodeURIComponent(compiled));
}
const normalized=await runtime('../src/lib/providers/normalizeOdds.ts',[[/import \{impliedProbability\} from '..\/math';/,`const impliedProbability=o=>o<0?-o/(100-o):100/(100+o);`]]);
const espn=await runtime('../src/lib/providers/espnCoreOdds.ts',[[/import \{ESPN_SCOREBOARD_FEEDS\} from '..\/sportRegistry';/,`const ESPN_SCOREBOARD_FEEDS=[];`]]);
const sgo=await runtime('../src/lib/providers/sportsGameOdds.ts');

test('event player props preserve athlete identity and independent market groups',()=>{
 const result=normalized.normalizeOddsPayload([{id:'game',sport_title:'NBA',commence_time:new Date(Date.now()+3600000).toISOString(),home_team:'Home',away_team:'Away',bookmakers:[{title:'DraftKings',markets:[{key:'player_points',outcomes:[{name:'Over',description:'Player One',point:22.5,price:-110},{name:'Under',description:'Player One',point:22.5,price:-110},{name:'Over',description:'Player Two',point:18.5,price:-110},{name:'Under',description:'Player Two',point:18.5,price:-110}]}]}]}]);
 assert.equal(result.markets.length,4);
 assert.equal(result.markets[0].playerContext.name,'Player One');
 assert.match(result.markets[0].selection,/Player One Over/);
 assert.equal(result.markets[2].playerContext.name,'Player Two');
 assert.ok(result.markets.every(x=>Math.abs(x.marketProb-.5)<.00001));
});
test('rotating ESPN coverage retains other leagues and expires stale or started quotes',()=>{
 const now=Date.now();
 const row=(id,age=0,start=3600000)=>({id,pulledAt:new Date(now-age).toISOString(),startTime:new Date(now+start).toISOString()});
 const merged=espn.mergeEspnCoverage([row('NFL'),row('old',250000),row('started',0,-1)],[row('NHL'),row('NFL')],now);
 assert.deepEqual(merged.map(x=>x.id),['NFL','NHL']);
});
test('SportsGameOdds player over-under keeps player name and stat in normalized row',()=>{
 const p={data:[{eventID:'g',leagueID:'NBA',status:{startsAt:new Date(Date.now()+3600000).toISOString()},teams:{home:{teamID:'h',names:{long:'Home'}},away:{teamID:'a',names:{long:'Away'}}},players:{p1:{name:'Player One'}},odds:{'points-p1-game-ou-over':{playerID:'p1',sideID:'over',statID:'points',betTypeID:'ou',byBookmaker:{draftkings:{available:true,odds:'-110',overUnder:22.5}}}}}]};
 const result=sgo.flattenSportsGameOdds(p);
 assert.equal(result.rows[0].playerName,'Player One');
 assert.equal(result.rows[0].market,'player_points');
 assert.match(result.rows[0].selection,/Player One over 22.5/);
});

const odds=await runtime('../src/lib/providers/theOddsApi.ts',[[/import \{adaptiveOddsPolicy,type ActiveSport,type AdaptiveOddsPolicy\} from '.\/oddsRefreshPolicy';/,`const adaptiveOddsPolicy=()=>({selectedSports:[],mode:'test',refreshMinutes:1,reasons:[]});`]]);
test('event prop expansion merges with game markets instead of dropping duplicate event id',()=>{
 const [merged]=odds.uniqueEvents([{id:'game',bookmakers:[{key:'draftkings',markets:[{key:'h2h',outcomes:[]}]}]},{id:'game',bookmakers:[{key:'draftkings',markets:[{key:'player_points',outcomes:[]}]}]}]);
 assert.deepEqual(merged.bookmakers[0].markets.map(x=>x.key),['h2h','player_points']);
});
test('a failed second SportsGameOdds page retains the first page',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{if(calls++)throw new Error('page deadline');return Response.json({nextCursor:'next',data:[{eventID:'g',leagueID:'MLS',status:{startsAt:new Date(Date.now()+3600000).toISOString()},teams:{home:{names:{long:'Home'}},away:{names:{long:'Away'}}},odds:{h2h:{sideID:'home',marketName:'Moneyline',byBookmaker:{draftkings:{odds:'-110'}}}}}]});};
 try{const result=await sgo.fetchSportsGameOddsBoard({id:'sgo',name:'SportsGameOdds',capability:'ODDS',apiKey:'test'});assert.equal(result.ok,true);assert.equal(result.data.length,1);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
const poly=await runtime('../src/lib/providers/polymarket.ts');
test('Polymarket follows cursors, drops unpriced contracts and caches polling requests',async()=>{
 const original=globalThis.fetch;const urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));return Response.json(urls.length===1?{markets:[{id:'first',question:'First?',outcomes:['Yes','No'],outcomePrices:['0.6','0.4']},{id:'missing',question:'Missing price'}],next_cursor:'next'}:{markets:[{id:'second',question:'Second?',outcomes:['Yes','No'],outcomePrices:['0.3','0.7']}],next_cursor:null});};
 try{const result=await poly.fetchPublicPolymarket();assert.equal(result.contracts.length,2);assert.match(urls[1],/after_cursor=next/);await poly.fetchPublicPolymarket();assert.equal(urls.length,2);}finally{globalThis.fetch=original;}
});

test('ESPN current Draft Kings nested closing quotes yield all six real lines',()=>{
 const quotes={provider:{name:'Draft Kings'},spread:-1.5,overUnder:6.5,homeTeamOdds:{favorite:true},awayTeamOdds:{favorite:false},moneyline:{home:{close:{odds:'-298'}},away:{close:{odds:'+240'}}},pointSpread:{home:{close:{line:'-1.5',odds:'-112'}},away:{close:{line:'+1.5',odds:'-108'}}},total:{over:{close:{line:'o6.5',odds:'-102'}},under:{close:{line:'u6.5',odds:'-118'}}}};
 const rows=espn.normalizeEspnOddsItems({items:[quotes]},{eventId:'real',home:'Devils',away:'Canucks',startTime:new Date(Date.now()+3600000).toISOString()},'NHL');
 assert.equal(rows.length,6);assert.ok(rows.every(x=>x.bookmaker==='DraftKings'));assert.ok(rows.some(x=>x.selection==='Over 6.5'&&x.odds===-102));assert.ok(rows.some(x=>x.selection==='Devils -1.5'&&x.odds===-112));
});
