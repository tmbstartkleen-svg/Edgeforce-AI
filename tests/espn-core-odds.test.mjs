import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const ts=createRequire(import.meta.url)('typescript');
const source=readFileSync(new URL('../src/lib/providers/espnCoreOdds.ts',import.meta.url),'utf8')
 .replace(/import type .*?;\n/g,'')
 .replace(/import \{ESPN_SCOREBOARD_FEEDS\} from '..\/sportRegistry';\n/,"const ESPN_SCOREBOARD_FEEDS=[];\n");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const runtime=await import('data:text/javascript,'+encodeURIComponent(compiled.outputText));

const meta={eventId:'401000001',startTime:'2026-10-07T00:00:00Z',home:'Home Team',away:'Away Team'};

test('normalizes complete DraftKings moneyline spread and total markets',()=>{
 const payload={items:[{
  provider:{id:'41',name:'DraftKings'},
  spread:-3.5,overUnder:47.5,overOdds:-110,underOdds:-110,
  homeTeamOdds:{favorite:true,moneyLine:-165,spreadOdds:-110},
  awayTeamOdds:{favorite:false,moneyLine:140,spreadOdds:-110}
 }]};
 const rows=runtime.normalizeEspnOddsItems(payload,meta,'NFL','2026-10-06T22:00:00Z');
 assert.equal(rows.length,6);
 assert.ok(rows.some(x=>x.market==='h2h'&&x.selection==='Home Team'&&x.odds===-165));
 assert.ok(rows.some(x=>x.market==='spreads'&&x.selection==='Home Team -3.5'));
 assert.ok(rows.some(x=>x.market==='spreads'&&x.selection==='Away Team +3.5'));
 assert.ok(rows.some(x=>x.market==='totals'&&x.selection==='Over 47.5'));
 assert.ok(rows.every(x=>x.bookmaker==='DraftKings'));
 assert.ok(rows.every(x=>x.eventId==='401000001'));
 assert.ok(rows.every(x=>x.liveEligible===false));
});

test('orients away-favorite spread correctly',()=>{
 const payload={items:[{
  provider:{name:'FanDuel'},
  spread:-2.5,
  homeTeamOdds:{favorite:false,moneyLine:120,spreadOdds:-105},
  awayTeamOdds:{favorite:true,moneyLine:-140,spreadOdds:-115}
 }]};
 const rows=runtime.normalizeEspnOddsItems(payload,meta,'NBA');
 assert.ok(rows.some(x=>x.selection==='Away Team -2.5'));
 assert.ok(rows.some(x=>x.selection==='Home Team +2.5'));
});

test('rejects unapproved books and incomplete one-sided markets',()=>{
 const payload={items:[
  {provider:{name:'UnknownBook'},homeTeamOdds:{moneyLine:-120},awayTeamOdds:{moneyLine:110}},
  {provider:{name:'BetMGM'},homeTeamOdds:{moneyLine:-120},awayTeamOdds:{}},
  {provider:{name:'Caesars'},overUnder:44.5,overOdds:-110}
 ]};
 assert.equal(runtime.normalizeEspnOddsItems(payload,meta,'NFL').length,0);
});

test('provider is no-key and can be explicitly disabled',()=>{
 const p=runtime.espnCoreOddsProvider({});
 assert.ok(p);
 assert.equal(p.capability,'ODDS');
 assert.equal(p.url,'espn-core://odds');
 assert.equal(p.marketRole,'REFERENCE');
 assert.equal(runtime.espnCoreOddsProvider({ESPN_CORE_ODDS_ENABLED:'false'}),null);
});

test('provider uses bounded cache and fan-out defaults',()=>{
 assert.match(source,/ESPN_CORE_ODDS_CACHE_MS\|\|120000/);
 assert.match(source,/ESPN_CORE_ODDS_LEAGUES_PER_BATCH\|\|5/);
 assert.match(source,/ESPN_CORE_ODDS_EVENTS_PER_LEAGUE\|\|12/);
 assert.match(source,/meta\.state&&meta\.state!=='pre'/);
});
