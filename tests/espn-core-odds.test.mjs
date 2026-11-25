import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {loadProvider} from './helpers/load-provider.mjs';

const source=readFileSync(new URL('../src/lib/providers/espnCoreOdds.ts',import.meta.url),'utf8');
const runtime=loadProvider('espnCoreOdds');
const registry=loadProvider('../sportRegistry');
// Real NBA scoreboard odds captured November 25, 2026; unrelated links/logos omitted.
const captured=JSON.parse(readFileSync(new URL('./fixtures/espn-scoreboard-modern-odds.json',import.meta.url),'utf8'));
const observedAt='2026-11-25T12:00:00.000Z';
const meta={eventId:'401000001',startTime:'2026-11-25T22:00:00Z',home:'Home Team',away:'Away Team',state:'pre'};
const normalize=(items,sport='NBA',metadata=meta,observed=observedAt)=>runtime.normalizeEspnOddsItems({items},metadata,sport,observed);
const modernItem=()=>structuredClone(captured.events[0].competitions[0].odds[0]);
const legacyItem=()=>({provider:{name:'DraftKings'},spread:-3.5,overUnder:47.5,overOdds:-110,underOdds:-110,
 homeTeamOdds:{favorite:true,moneyLine:-165,spreadOdds:-110},awayTeamOdds:{favorite:false,moneyLine:140,spreadOdds:-110}});
const providerSettings=['DEPLOYMENT_PLATFORM','ESPN_CORE_ODDS_CACHE_MS','ESPN_CORE_ODDS_TIMEOUT_MS',
 'ESPN_CORE_ODDS_LEAGUES_PER_BATCH','ESPN_CORE_ODDS_MAX_REQUESTS','ESPN_CORE_ODDS_EVENTS_PER_LEAGUE','ESPN_CORE_ODDS_BATCH_TIMEOUT_MS'];
function acquisitionRuntime(t,ids=['nba','nfl'],env={}){
 const savedFetch=globalThis.fetch,saved=new Map(providerSettings.map(key=>[key,process.env[key]]));
 t.after(()=>{globalThis.fetch=savedFetch;for(const [key,value] of saved){if(value===undefined)delete process.env[key];else process.env[key]=value}});
 for(const key of providerSettings)delete process.env[key];
 Object.assign(process.env,{DEPLOYMENT_PLATFORM:'cloudflare',...env});
 return loadProvider('espnCoreOdds',{'../sportRegistry':{...registry,ESPN_SCOREBOARD_FEEDS:registry.ESPN_SCOREBOARD_FEEDS.filter(feed=>ids.includes(feed.id))}});
}
function futureBoard({now=Date.now(),count=1,odds=true}={}){
 return {events:Array.from({length:count},(_,i)=>{
  const event=structuredClone(captured.events[0]);event.id='event-'+i;event.competitions[0].id=event.id;
  event.date=new Date(now+3600000).toISOString();event.competitions[0].date=event.date;
  if(!odds)delete event.competitions[0].odds;
  return event;
 })};
}
const response=payload=>new Response(JSON.stringify(payload),{status:200});

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

test('Cloudflare default preserves eight-request budget and cached batches issue no new requests',async t=>{
 const api=acquisitionRuntime(t),calls=[];
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  return response(url.includes('/scoreboard')?futureBoard({count:20,odds:false}):{items:[legacyItem()]});
 };
 const config=api.espnCoreOddsProvider({});
 const first=await api.fetchEspnCoreOdds(config);
 assert.equal(first.ok,true);
 assert.equal(calls.length,8);
 assert.equal(calls.filter(url=>url.includes('/scoreboard')).length,2);
 assert.ok(calls.slice(0,2).every(url=>url.includes('/scoreboard')));
 assert.ok(calls.slice(2,4).some(url=>url.includes('/leagues/nba/')));
 assert.ok(calls.slice(2,4).some(url=>url.includes('/leagues/nfl/')),'optional Core slots alternate leagues');
 const second=await api.fetchEspnCoreOdds(config);
 assert.equal(calls.length,8);
 assert.deepEqual(second.data,first.data);
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
 assert.match(source,/phase\(selected,feed=>scoreboard\(feed,0\)\)/);
 assert.match(source,/phase\(tomorrow,feed=>scoreboard\(feed,1\)\)/);
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

test('every selected league gets a current-day request before an empty league can spend the remaining budget',async t=>{
 const api=acquisitionRuntime(t,['nba','nfl'],{ESPN_CORE_ODDS_MAX_REQUESTS:'2'}),calls=[];
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  return response(url.includes('/basketball/nba/')?{events:[]}:futureBoard());
 };
 const result=await api.fetchEspnCoreOdds(api.espnCoreOddsProvider({}));
 assert.equal(calls.length,2);
 assert.ok(calls.some(url=>url.includes('/football/nfl/scoreboard')));
 assert.equal(result.ok,true);
 assert.equal(result.data.length,6);
 assert.ok(result.data.every(row=>row.sport==='NFL'));
});

test('parallel provider callers share acquisition and a slow league body cannot hide another completed league',async t=>{
 const api=acquisitionRuntime(t,['nba','nfl'],{ESPN_CORE_ODDS_BATCH_TIMEOUT_MS:'80'}),calls=[];
 let rejectLate;
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  if(url.includes('/basketball/nba/'))return {ok:true,status:200,json:()=>new Promise((_,reject)=>{rejectLate=reject})};
  return response(futureBoard());
 };
 const config=api.espnCoreOddsProvider({}),started=Date.now();
 const [first,second]=await Promise.all([api.fetchEspnCoreOdds(config),api.fetchEspnCoreOdds(config)]);
 assert.ok(Date.now()-started<600);
 assert.equal(calls.length,2);
 assert.equal(first.ok,true);
 assert.equal(first.data.length,6);
 assert.ok(first.data.every(row=>row.sport==='NFL'&&row.evidenceClass==='OBSERVED_REFERENCE'&&row.sourceTimestamp===undefined));
 assert.deepEqual(second.data,first.data);
 rejectLate(new Error('late body failure'));await delay(0);
 const cached=await api.fetchEspnCoreOdds(config);
 assert.equal(calls.length,2);
 assert.deepEqual(cached.data,first.data,'late failure cannot erase or renew acquired observations');
});

test('a blocked Core fallback returns already acquired embedded quotes within the shared deadline',async t=>{
 const api=acquisitionRuntime(t,['nba','nfl'],{ESPN_CORE_ODDS_MAX_REQUESTS:'3',ESPN_CORE_ODDS_BATCH_TIMEOUT_MS:'60'}),calls=[];
 globalThis.fetch=async(url,options)=>{
  url=String(url);calls.push(url);
  if(url.includes('/scoreboard'))return response(futureBoard({odds:url.includes('/basketball/nba/')}));
  return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Core mock aborted')),{once:true}));
 };
 const started=Date.now(),result=await api.fetchEspnCoreOdds(api.espnCoreOddsProvider({}));
 assert.ok(Date.now()-started<600);
 assert.equal(calls.length,3);
 assert.ok(calls.slice(0,2).every(url=>url.includes('/scoreboard')));
 assert.equal(result.ok,true);
 assert.equal(result.data.length,6);
 assert.ok(result.data.every(row=>row.sport==='NBA'));
});

test('completed league observations survive another batch failure without receipt-time renewal and expire after five minutes',async t=>{
 const SavedDate=Date;let clock=Date.now(),mode=0;
 t.after(()=>{globalThis.Date=SavedDate});
 globalThis.Date=class extends SavedDate{
  constructor(...args){super(...(args.length?args:[clock]))}
  static now(){return clock}
 };
 const api=acquisitionRuntime(t),calls=[];
 globalThis.fetch=async url=>{
  url=String(url);calls.push(url);
  const nba=url.includes('/basketball/nba/');
  if((mode===0&&nba)||(mode===1&&!nba))return response(futureBoard({now:clock}));
  throw new Error('mock scoreboard unavailable');
 };
 const config=api.espnCoreOddsProvider({});
 const first=await api.fetchEspnCoreOdds(config),nbaAt=first.data[0].quoteObservedAt;
 assert.equal(first.data.length,6);
 clock+=120001;mode=1;
 const mixed=await api.fetchEspnCoreOdds(config);
 assert.equal(mixed.data.length,12);
 assert.ok(mixed.data.filter(row=>row.sport==='NBA').every(row=>row.quoteObservedAt===nbaAt));
 const nflAt=mixed.data.find(row=>row.sport==='NFL').quoteObservedAt;
 clock+=180001;mode=2;
 const oldNbaExpired=await api.fetchEspnCoreOdds(config);
 assert.equal(oldNbaExpired.data.length,6);
 assert.ok(oldNbaExpired.data.every(row=>row.sport==='NFL'&&row.quoteObservedAt===nflAt));
 clock+=120001;
 const allExpired=await api.fetchEspnCoreOdds(config);
 assert.equal(allExpired.ok,false);
 assert.equal(allExpired.data.length,0);
 assert.equal(calls.length,8,'each refresh stays within the existing two selected leagues');
});

test('invalid request-count configuration cannot disable the unchanged Cloudflare request limit',async t=>{
 const api=acquisitionRuntime(t,['nba','nfl'],{ESPN_CORE_ODDS_MAX_REQUESTS:'NaN',ESPN_CORE_ODDS_LEAGUES_PER_BATCH:'Infinity'});
 let calls=0;
 globalThis.fetch=async url=>{calls++;return response(String(url).includes('/scoreboard')?futureBoard({count:20,odds:false}):{items:[]})};
 await api.fetchEspnCoreOdds(api.espnCoreOddsProvider({}));
 assert.equal(calls,8);
});

test('a revised event supersedes old quotes retained from an overlapping scoreboard date window',async t=>{
 const SavedDate=Date;let clock=Date.now(),revision=false;
 t.after(()=>{globalThis.Date=SavedDate});
 globalThis.Date=class extends SavedDate{
  constructor(...args){super(...(args.length?args:[clock]))}
  static now(){return clock}
 };
 const api=acquisitionRuntime(t,['nba']),today=new Date(clock).toISOString().slice(0,10).replaceAll('-','');
 const initial=futureBoard({now:clock});
 const revised=structuredClone(initial);
 revised.events[0].competitions[0].odds[0].pointSpread.home.close.line='-2.5';
 revised.events[0].competitions[0].odds[0].pointSpread.away.close.line='+2.5';
 globalThis.fetch=async url=>{
  const date=new URL(String(url)).searchParams.get('dates');
  return response(revision?revised:date===today?{events:[]}:initial);
 };
 const config=api.espnCoreOddsProvider({});
 const first=await api.fetchEspnCoreOdds(config);
 assert.equal(first.data.length,6);
 assert.ok(first.data.some(row=>row.selection.endsWith('-1.5')));
 clock+=120001;revision=true;
 const second=await api.fetchEspnCoreOdds(config);
 assert.equal(second.data.length,6);
 assert.ok(second.data.some(row=>row.selection.endsWith('-2.5')));
 assert.ok(second.data.every(row=>!row.selection.endsWith('-1.5')&&!row.selection.endsWith('+1.5')));
});
