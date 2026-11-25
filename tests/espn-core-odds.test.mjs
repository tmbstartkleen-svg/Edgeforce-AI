import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {loadProvider} from './helpers/load-provider.mjs';

const source=readFileSync(new URL('../src/lib/providers/espnCoreOdds.ts',import.meta.url),'utf8');
const runtime=loadProvider('espnCoreOdds');
// Real NBA scoreboard odds captured November 25, 2026; unrelated links/logos omitted.
const captured=JSON.parse(readFileSync(new URL('./fixtures/espn-scoreboard-modern-odds.json',import.meta.url),'utf8'));
const observedAt='2026-11-25T12:00:00.000Z';
const meta={eventId:'401000001',startTime:'2026-11-25T22:00:00Z',home:'Home Team',away:'Away Team',state:'pre'};
const normalize=(items,sport='NBA',metadata=meta,observed=observedAt)=>runtime.normalizeEspnOddsItems({items},metadata,sport,observed);
const modernItem=()=>structuredClone(captured.events[0].competitions[0].odds[0]);
const legacyItem=()=>({provider:{name:'DraftKings'},spread:-3.5,overUnder:47.5,overOdds:-110,underOdds:-110,
 homeTeamOdds:{favorite:true,moneyLine:-165,spreadOdds:-110},awayTeamOdds:{favorite:false,moneyLine:140,spreadOdds:-110}});

test('captured modern ESPN scoreboard normalizes complete current pairs as observed reference data',()=>{
 const rows=captured.events.flatMap(event=>runtime.normalizeEspnEmbeddedOdds(event,'NBA',observedAt));
 assert.equal(captured.events.length,9);
 assert.equal(rows.length,54);
 assert.equal(new Set(rows.map(row=>row.eventId)).size,9);
 assert.ok(rows.every(row=>row.bookmaker==='DraftKings'));
 assert.ok(rows.every(row=>row.evidenceClass==='OBSERVED_REFERENCE'&&row.liveEligible===false));
 assert.ok(rows.every(row=>row.quoteObservedAt===observedAt&&row.pulledAt===observedAt));
 assert.ok(rows.every(row=>row.sourceTimestamp===undefined));
 assert.ok(rows.every(row=>Date.parse(row.startTime)>Date.parse(observedAt)));
 const first=rows.filter(row=>row.eventId==='401909317');
 assert.deepEqual(first.map(row=>[row.market,row.selection,row.odds]),[
  ['h2h','Philadelphia 76ers',-116],['h2h','Miami Heat',-102],
  ['spreads','Philadelphia 76ers -1.5',-106],['spreads','Miami Heat +1.5',-114],
  ['totals','Over 236.5',-113],['totals','Under 236.5',-107]
 ]);
});

test('normalizes complete DraftKings moneyline spread and total markets',()=>{
 const payload={items:[{
  provider:{id:'41',name:'DraftKings'},
  spread:-3.5,overUnder:47.5,overOdds:-110,underOdds:-110,
  homeTeamOdds:{favorite:true,moneyLine:-165,spreadOdds:-110},
  awayTeamOdds:{favorite:false,moneyLine:140,spreadOdds:-110}
 }]};
 const rows=runtime.normalizeEspnOddsItems(payload,meta,'NFL',observedAt);
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
 const rows=runtime.normalizeEspnOddsItems(payload,meta,'NBA',observedAt);
 assert.ok(rows.some(x=>x.selection==='Away Team -2.5'));
 assert.ok(rows.some(x=>x.selection==='Home Team +2.5'));
});

test('rejects unapproved books and incomplete one-sided markets',()=>{
 const payload={items:[
  {provider:{name:'UnknownBook'},homeTeamOdds:{moneyLine:-120},awayTeamOdds:{moneyLine:110}},
  {provider:{name:'BetMGM'},homeTeamOdds:{moneyLine:-120},awayTeamOdds:{}},
  {provider:{name:'Caesars'},overUnder:44.5,overOdds:-110}
 ]};
 assert.equal(runtime.normalizeEspnOddsItems(payload,meta,'NFL',observedAt).length,0);
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
 assert.match(source,/ESPN_CORE_ODDS_LEAGUES_PER_BATCH\|\|\(process\.env\.DEPLOYMENT_PLATFORM==='cloudflare'\?2:5\)/);
 assert.match(source,/ESPN_CORE_ODDS_MAX_REQUESTS\|\|\(process\.env\.DEPLOYMENT_PLATFORM==='cloudflare'\?8:24\)/);
 assert.match(source,/ESPN_CORE_ODDS_EVENTS_PER_LEAGUE\|\|12/);
 assert.match(source,/if\(remaining<=0\)throw new Error\('ESPN request budget exhausted'\)/);
 assert.ok(source.indexOf('for(const {meta,feed} of fallbacks)')>source.indexOf('for(const feed of rotatingFeeds())'));
});


test('normalizes embedded scoreboard odds without requiring Core fan-out',()=>{
 const event={
  id:'401000002',
  date:'2026-11-25T22:00:00Z',
  competitions:[{
   id:'401000002',
   date:'2026-11-25T22:00:00Z',
   status:{type:{state:'pre'}},
   competitors:[
    {homeAway:'home',team:{displayName:'Home Club'}},
    {homeAway:'away',team:{displayName:'Away Club'}}
   ],
   odds:[{
    provider:{name:'ESPN BET'},
    spread:-4.5,overUnder:51.5,overOdds:-115,underOdds:-105,
    homeTeamOdds:{favorite:true,moneyLine:-190,spreadOdds:-110},
    awayTeamOdds:{favorite:false,moneyLine:160,spreadOdds:-110}
   }]
  }]
 };
 const rows=runtime.normalizeEspnEmbeddedOdds(event,'NCAAF',observedAt);
 assert.equal(rows.length,6);
 assert.ok(rows.some(x=>x.selection==='Home Club -4.5'));
 assert.ok(rows.some(x=>x.selection==='Away Club +4.5'));
 assert.ok(rows.every(x=>x.bookmaker==='ESPN BET'));
});

test('embedded odds reject events that are already live',()=>{
 const event={
  id:'401000003',
  competitions:[{
   id:'401000003',
   date:'2026-11-25T22:00:00Z',
   status:{type:{state:'in'}},
   competitors:[
    {homeAway:'home',team:{displayName:'Home'}},
    {homeAway:'away',team:{displayName:'Away'}}
   ],
   odds:[{provider:{name:'DraftKings'},homeTeamOdds:{moneyLine:-120},awayTeamOdds:{moneyLine:110}}]
  }]
 };
 assert.equal(runtime.normalizeEspnEmbeddedOdds(event,'NFL',observedAt).length,0);
});

test('only explicitly pregame future events can produce observed reference rows',()=>{
 for(const state of ['in','post','',undefined]){
  const event=structuredClone(captured.events[0]);
  event.competitions[0].status.type.state=state;
  assert.equal(runtime.normalizeEspnEmbeddedOdds(event,'NBA',observedAt).length,0,String(state));
 }
 for(const startTime of [observedAt,'2026-11-25T11:59:59Z','invalid','2026-11-25T22:00:00']){
  const event=structuredClone(captured.events[0]);
  event.competitions[0].date=startTime;
  assert.equal(runtime.normalizeEspnEmbeddedOdds(event,'NBA',observedAt).length,0,startTime);
  assert.equal(normalize([modernItem()],'NBA',{...meta,startTime}).length,0,startTime);
 }
 for(const observed of ['', 'invalid', '2026-11-25T12:00:00'])assert.equal(normalize([modernItem()],'NBA',meta,observed).length,0);
});

test('modern close contracts never borrow opening or legacy prices for missing current sides',()=>{
 for(const [property,market,side] of [['moneyline','h2h','away'],['pointSpread','spreads','away'],['total','totals','under']]){
  for(const shape of ['missing-close','null-contract','empty-contract']){
   const item={...legacyItem(),...modernItem()};
   Object.assign(item,{homeTeamOdds:legacyItem().homeTeamOdds,awayTeamOdds:legacyItem().awayTeamOdds,
    overUnder:47.5,overOdds:-110,underOdds:-110});
   if(shape==='missing-close')delete item[property][side].close;
   else item[property]=shape==='null-contract'?null:{};
   const rows=normalize([item]);
   assert.equal(rows.filter(row=>row.market===market).length,0,`${property}:${shape}`);
   assert.equal(rows.length,4,`${property}:${shape}`);
  }
 }
 const onlyOpen=modernItem();
 for(const [key,sides] of [['moneyline',['home','away']],['pointSpread',['home','away']],['total',['over','under']]]){
  for(const side of sides)delete onlyOpen[key][side].close;
 }
 assert.equal(normalize([onlyOpen]).length,0);
});

test('modern current values prevail over conflicting legacy and opening values',()=>{
 const item={...modernItem(),homeTeamOdds:legacyItem().homeTeamOdds,awayTeamOdds:legacyItem().awayTeamOdds,
  spread:-9.5,overUnder:99.5,overOdds:-120,underOdds:110};
 const rows=normalize([item]);
 assert.equal(rows.length,6);
 assert.equal(rows.find(row=>row.market==='h2h'&&row.selection==='Home Team').odds,-116);
 assert.ok(rows.some(row=>row.selection==='Home Team -1.5'&&row.odds===-106));
 assert.ok(rows.some(row=>row.selection==='Over 236.5'&&row.odds===-113));
});

test('American prices require complete finite integer numeric evidence',()=>{
 for(const invalid of [null,undefined,true,false,[],[120],{},'', 'EVEN','120junk','1e3','0x80',0,99,100.5,Infinity,100001]){
  const item=modernItem();item.moneyline.home.close.odds=invalid;
  assert.equal(normalize([item]).filter(row=>row.market==='h2h').length,0,String(invalid));
 }
 for(const invalid of [null,true,[], '']){
  const item=legacyItem();item.homeTeamOdds.moneyLine=invalid;
  assert.equal(normalize([item]).filter(row=>row.market==='h2h').length,0,String(invalid));
 }
});

test('spread pairs require opposite explicit lines and retain legitimate zero spreads',()=>{
 for(const [homeLine,awayLine,accepted] of [[-1.5,1.5,true],[0,0,true],['-1.5','+1.5',true],[-1.5,2.5,false],
  [-1.5,-1.5,false],[null,1.5,false],['',0,false],[false,0,false],['-1.5 points','1.5',false]]){
  const item=modernItem();item.pointSpread.home.close.line=homeLine;item.pointSpread.away.close.line=awayLine;
  const spreads=normalize([item]).filter(row=>row.market==='spreads');
  assert.equal(spreads.length,accepted?2:0,JSON.stringify([homeLine,awayLine]));
  if(homeLine===0)assert.deepEqual(spreads.map(row=>row.selection),['Home Team 0','Away Team 0']);
 }
 const legacy=legacyItem();legacy.spread=0;
 assert.equal(normalize([legacy]).filter(row=>row.market==='spreads').length,2);
 delete legacy.spread;
 assert.equal(normalize([legacy]).filter(row=>row.market==='spreads').length,0);
});

test('totals require matching numeric thresholds with consistent over and under prefixes',()=>{
 for(const [overLine,underLine,accepted] of [['o236.5','u236.5',true],[236.5,236.5,true],['236.5','236.5',true],
  ['o236.5','u237.5',false],['u236.5','o236.5',false],[null,null,false],['','',false],[false,false,false],
  ['o236.5 trailing','u236.5',false],[-1,-1,false]]){
  const item=modernItem();item.total.over.close.line=overLine;item.total.under.close.line=underLine;
  assert.equal(normalize([item]).filter(row=>row.market==='totals').length,accepted?2:0,JSON.stringify([overLine,underLine]));
 }
});

test('soccer, unknown and explicitly three-way moneylines cannot lose their draw outcome',()=>{
 for(const sport of ['Soccer','EPL','MLS','LaLiga','Unknown','UFC']){
  assert.equal(normalize([modernItem()],sport).filter(row=>row.market==='h2h').length,0,sport);
  assert.equal(normalize([legacyItem()],sport).filter(row=>row.market==='h2h').length,0,sport);
 }
 for(const extra of ['draw','tie']){
  const item=modernItem();item.moneyline[extra]={close:{odds:'+300'}};
  assert.equal(normalize([item]).filter(row=>row.market==='h2h').length,0,extra);
 }
});

test('observation time never substitutes for unavailable or invalid odds source timestamps',()=>{
 const sourceTime='2026-11-25T11:58:00.000Z';
 const item=modernItem();item.lastUpdated=sourceTime;
 let rows=normalize([item]);
 assert.ok(rows.every(row=>row.sourceTimestamp===sourceTime&&row.quoteObservedAt===observedAt));
 assert.ok(rows.every(row=>row.evidenceClass==='OBSERVED_REFERENCE'));
 for(const invalid of [undefined,'invalid','2026-11-25T11:58:00','2026-11-25T12:00:31Z',null,123]){
  const record=modernItem();record.lastUpdated=invalid;
  record.provider.logos=[{lastUpdated:sourceTime}];
  rows=normalize([record]);
  assert.equal(rows.length,6);
  assert.ok(rows.every(row=>row.sourceTimestamp===undefined));
  assert.ok(rows.every(row=>row.quoteObservedAt===observedAt));
 }
});

test('provider prefers embedded scoreboard odds and only falls back to Core',()=>{
 assert.match(source,/embeddedOdds:arr\(competition\.odds\)/);
 assert.match(source,/const embeddedRows=normalizeEspnOddsItems/);
 assert.match(source,/if\(embeddedRows\.length\)/);
 assert.match(source,/for\(const offset of \[0,1\]\)/);
});


test('prioritizes non-PropLine coverage gaps before supplemental leagues',()=>{
 assert.match(source,/const GAP_PRIORITY_IDS=\[/);
 assert.match(source,/'ncaaf'/);
 assert.match(source,/'nba'/);
 assert.match(source,/'wnba'/);
 assert.match(source,/'ncaam-basketball'/);
 assert.match(source,/'mls'/);
 assert.match(source,/'epl'/);
 assert.match(source,/const SUPPLEMENTAL_IDS=\[/);
 assert.match(source,/'nfl'/);
 assert.match(source,/'nhl'/);
 assert.match(source,/'mlb'/);
 assert.match(source,/width===1\?1:width-1/);
});
