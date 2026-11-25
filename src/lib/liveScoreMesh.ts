import {ESPN_SCOREBOARD_FEEDS,sportCoverageSummary} from './sportRegistry';
import {fetchSportScoreBackup} from './providers/sportScore';
import {fetchCommunityScoreBackups} from './providers/communityScoreBackups';
import {normalizeEspnEmbeddedOdds} from './providers/espnCoreOdds';
import {normalizeOddsPayload} from './providers/normalizeOdds';
import {buildObservedOddsSnapshot,mergeObservedOddsSnapshots,type ObservedOddsSnapshot} from './observedOdds';
export type LiveScoreConsensus={
 confidence:'HIGH'|'MEDIUM'|'LOW'|'SINGLE_SOURCE';
 sourceCount:number;
 observationCount:number;
 agreeingSources:number;
 sources:string[];
 selectedSource:string;
 scoreConflict:boolean;
 statusConflict:boolean;
 activeConflict:boolean;
 laggingSources:string[];
 reasons:string[];
};
export type LiveGameState={
 id:string;
 sport:string;
 league:string;
 source:string;
 status:'SCHEDULED'|'LIVE'|'FINAL'|'DELAYED'|'UNKNOWN';
 detail:string;
 clock?:string;
 period?:string;
 startTime?:string;
 home:{name:string;score:number|null};
 away:{name:string;score:number|null};
 observedAt:string;
 /** Original provider update timestamp, never inferred from local fetch time. */
 sourceObservedAt?:string;
 consensus?:LiveScoreConsensus;
};

type Cached={at:number;games:LiveGameState[]};
const cache=new Map<string,Cached>();
const inFlight=new Map<string,Promise<LiveGameState[]>>();
const observedOddsByLeague=new Map<string,ObservedOddsSnapshot>();
type CollectionSource={
 id:string;label:string;status:'FETCHED'|'CACHED'|'FAILED'|'DEFERRED';
 gameCount:number;referenceCount:number;observedAt?:string;error?:string;
};
type MeshCollection={
 partial:boolean;deadlineReached:boolean;deadlineMs:number;concurrency:number;sources:CollectionSource[];
};
const sourceAttempts=new Map<string,number>();
const sourceErrors=new Map<string,string>();
let attemptSequence=0;
let collection:MeshCollection|null=null;
let meshInFlight:Promise<ReturnType<typeof readCachedLiveScoreMesh>>|null=null;
let sportScoreSnapshot:Awaited<ReturnType<typeof fetchSportScoreBackup>>|null=null;
let communitySnapshot:Awaited<ReturnType<typeof fetchCommunityScoreBackups>>|null=null;
const nativeLiveTtlMs=()=>Math.max(1000,Number(process.env.LIVE_SCORE_NATIVE_LIVE_CACHE_MS||1000));
const nativeIdleTtlMs=()=>Math.max(nativeLiveTtlMs(),Number(process.env.LIVE_SCORE_NATIVE_IDLE_CACHE_MS||15000));
const espnCdnLiveTtlMs=()=>Math.max(750,Number(process.env.LIVE_SCORE_ESPN_CDN_LIVE_CACHE_MS||750));
const espnLiveTtlMs=()=>Math.max(1500,Number(process.env.LIVE_SCORE_ESPN_LIVE_CACHE_MS||3000));
const espnIdleTtlMs=()=>Math.max(espnLiveTtlMs(),Number(process.env.LIVE_SCORE_ESPN_IDLE_CACHE_MS||30000));
const staleFallbackMs=()=>Math.max(30000,Number(process.env.LIVE_SCORE_STALE_FALLBACK_MS||120000));
const timeoutMs=()=>Math.max(1500,Number(process.env.LIVE_SCORE_TIMEOUT_MS||5000));
const meshConcurrency=()=>Math.floor(clampMs(Number(process.env.LIVE_SCORE_FETCH_CONCURRENCY||6),6,1,6));
const meshDeadlineMs=(value?:number)=>clampMs(value??Number(process.env.LIVE_SCORE_BATCH_TIMEOUT_MS||4500),4500,50,5500);

const ESPN_LEAGUES=ESPN_SCOREBOARD_FEEDS
 .filter(x=>x.sportSlug&&x.leagueSlug)
 .map(x=>[x.sportSlug!,x.leagueSlug!,x.label,x.family] as const);


const ESPN_CDN_SLUG:Record<string,string>={
 NFL:'nfl',NCAAF:'college-football',NBA:'nba',WNBA:'wnba',NCAAB:'mens-college-basketball',
 MLB:'mlb',NHL:'nhl',MLS:'soccer',NWSL:'soccer',EPL:'soccer',LaLiga:'soccer',Bundesliga:'soccer','Serie A':'soccer','Ligue 1':'soccer',UCL:'soccer','Europa League':'soccer','FIFA World Cup':'soccer',"NCAA Men's Soccer":'soccer',"NCAA Women's Soccer":'soccer'
};

function obj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}}
function arr(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function str(v:unknown){return typeof v==='string'?v:''}
function num(v:unknown){
 if(v===null||v===undefined||typeof v==='boolean'||(typeof v==='string'&&!v.trim()))return null;
 if(typeof v!=='string'&&typeof v!=='number')return null;
 const n=Number(v);
 return Number.isFinite(n)&&n>=0? n:null;
}
function teamName(v:unknown){const t=obj(v);return str(t.displayName)||str(t.shortDisplayName)||str(t.name)||str(t.location)||str(t.abbreviation)||'Unknown'}
function normalizeStatus(v:string){
 const s=v.toLowerCase();
 if(s==='post'||/final|post/.test(s))return 'FINAL' as const;
 if(s==='in'||/in progress|live|halftime|end period|intermission/.test(s))return 'LIVE' as const;
 if(/delay|postpon/.test(s))return 'DELAYED' as const;
 if(s==='pre'||/pre|scheduled/.test(s))return 'SCHEDULED' as const;
 return 'UNKNOWN' as const;
}

const SOURCE_PRIORITY:Record<string,number>={
 'nhl-web':120,
 'mlb-statsapi':120,
 'espn-cdn':115,
 'espn-public':100,
 'api-sports':85,
 'football-data.org':75,
 'sportscore':65,
 'thesportsdb':55,
 'bigballsdata':50
};

const clampMs=(value:number,fallback:number,min:number,max:number)=>{
 const n=Number(value);
 return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
const uiFastMs=()=>clampMs(Number(process.env.LIVE_SCORE_UI_FAST_MS||750),750,500,5000);
const uiLiveMs=()=>clampMs(Number(process.env.LIVE_SCORE_UI_LIVE_MS||1000),1000,500,5000);
const uiDegradedMs=()=>clampMs(Number(process.env.LIVE_SCORE_UI_DEGRADED_MS||1500),1500,750,5000);
const uiIdleMs=()=>clampMs(Number(process.env.LIVE_SCORE_UI_IDLE_MS||3000),3000,1000,15000);
const consensusWindowMs=()=>clampMs(Number(process.env.LIVE_SCORE_CONSENSUS_WINDOW_MS||8000),8000,1000,30000);
const lagToleranceMs=()=>clampMs(Number(process.env.LIVE_SCORE_LAG_TOLERANCE_MS||3000),3000,500,15000);

function normalizeTeamKey(value:string){
 return value.toLowerCase().replace(/[^a-z0-9]/g,'');
}
export function liveGameIdentity(game:LiveGameState){
 const start=game.startTime?Date.parse(game.startTime):NaN;
 const bucket=Number.isFinite(start)?Math.floor(start/(3*60*60*1000)):
  game.id?`unknown-start:${game.source}:${game.id}`:'unknown-start';
 return [normalizeTeamKey(game.league),normalizeTeamKey(game.away.name),normalizeTeamKey(game.home.name),String(bucket)].join('|');
}
function statusRank(status:LiveGameState['status']){
 return status==='FINAL'?16:status==='LIVE'?14:status==='DELAYED'?8:status==='SCHEDULED'?4:0;
}
export function liveGameQuality(game:LiveGameState,now=Date.now()){
 const observed=Date.parse(game.observedAt);
 const ageMs=Number.isFinite(observed)&&observed<=now+2000?Math.max(0,now-observed):60000;
 const source=SOURCE_PRIORITY[game.source]??40;
 const scores=(validScore(game.home.score)?5:0)+(validScore(game.away.score)?5:0);
 const clock=game.clock?8:0;
 const period=game.period?3:0;
 const detail=game.detail?1:0;
 const freshness=ageMs<=1500?10:ageMs<=5000?7:ageMs<=15000?3:ageMs<=120000?0:-20;
 return source+statusRank(game.status)+scores+clock+period+detail+freshness;
}
function observationTime(game:LiveGameState){
 const value=Date.parse(game.observedAt);
 return Number.isFinite(value)?value:0;
}
function validScore(value:unknown):value is number{
 return typeof value==='number'&&Number.isFinite(value)&&value>=0;
}
function scoreKnown(game:LiveGameState){
 return validScore(game.home.score)&&validScore(game.away.score);
}
function sameScore(a:LiveGameState,b:LiveGameState){
 return scoreKnown(a)&&scoreKnown(b)&&a.home.score===b.home.score&&a.away.score===b.away.score;
}
function liveStatusConflict(a:LiveGameState,b:LiveGameState){
 const meaningful=new Set<LiveGameState['status']>(['SCHEDULED','LIVE','FINAL','DELAYED']);
 return meaningful.has(a.status)&&meaningful.has(b.status)&&a.status!==b.status;
}
export function liveScoreConsensus(observations:LiveGameState[],selected:LiveGameState,now=Date.now()):LiveScoreConsensus{
 const selectedAt=observationTime(selected)||now;
 const validObservation=(game:LiveGameState)=>{const at=observationTime(game);return at>0&&at<=now+2000&&now-at<=30000;};
 const contemporaneous=observations.filter(x=>validObservation(x)&&Math.abs(selectedAt-observationTime(x))<=consensusWindowMs());
 // Only a single latest observation per provider counts toward independent consensus.
 const peersBySource=new Map<string,LiveGameState>();
 for(const game of contemporaneous){
  const prior=peersBySource.get(game.source);
  if(!prior||observationTime(game)>observationTime(prior))peersBySource.set(game.source,game);
 }
 const peers=[...peersBySource.values()];
 const uniqueSources=[...peersBySource.keys()];
 const scorePeers=peers.filter(scoreKnown);
 const agreeing=scorePeers.filter(x=>sameScore(x,selected));
 const conflicting=scorePeers.filter(x=>!sameScore(x,selected));
 const lagging=conflicting.filter(x=>selectedAt-observationTime(x)>lagToleranceMs());
 const activeConflicts=conflicting.filter(x=>selectedAt-observationTime(x)<=lagToleranceMs());
 const statusConflicts=peers.filter(x=>liveStatusConflict(x,selected));
 const trusted=(SOURCE_PRIORITY[selected.source]??40)>=100;
 const selectedAge=validObservation(selected)?Math.max(0,now-selectedAt):Number.POSITIVE_INFINITY;
 const reasons:string[]=[];
 if(agreeing.length>=2)reasons.push('score corroborated by multiple sources');
 if(uniqueSources.length>=2)reasons.push(uniqueSources.length+' independent sources observed');
 if(lagging.length)reasons.push(lagging.length+' older source'+(lagging.length===1?' appears':'s appear')+' to be lagging');
 if(activeConflicts.length)reasons.push(activeConflicts.length+' contemporaneous score conflict'+(activeConflicts.length===1?'':'s')+' detected');
 if(statusConflicts.length)reasons.push(statusConflicts.length+' status conflict'+(statusConflicts.length===1?'':'s')+' detected');
 if(trusted)reasons.push('selected source is a high-trust league or ESPN feed');
 let confidence:LiveScoreConsensus['confidence']='SINGLE_SOURCE';
 if(!validObservation(selected))reasons.push('Selected observation lacks a valid recent timestamp');
 if(uniqueSources.length>=2&&validObservation(selected)){
  if(agreeing.length>=2&&!activeConflicts.length&&!statusConflicts.length)confidence='HIGH';
  else if(!activeConflicts.length&&!statusConflicts.length&&(trusted||agreeing.length>=1))confidence='MEDIUM';
  else if(trusted&&selectedAge<=5000&&activeConflicts.length<=1&&!statusConflicts.length)confidence='MEDIUM';
  else confidence='LOW';
 }
 return {
  confidence,
  sourceCount:uniqueSources.length,
  observationCount:observations.length,
  agreeingSources:new Set(agreeing.map(x=>x.source)).size,
  sources:uniqueSources,
  selectedSource:selected.source,
  scoreConflict:conflicting.length>0,
  statusConflict:statusConflicts.length>0,
  activeConflict:activeConflicts.length>0||statusConflicts.length>0,
  laggingSources:[...new Set(lagging.map(x=>x.source))],
  reasons
 };
}
export function reconcileLiveGames(...groups:LiveGameState[][]){
 const observations=new Map<string,LiveGameState[]>();
 for(const game of groups.flat()){
  const key=liveGameIdentity(game);
  const list=observations.get(key)||[];
  list.push(game);
  observations.set(key,list);
 }
 const selected:LiveGameState[]=[];
 for(const rows of observations.values()){
  const winner=[...rows].sort((a,b)=>{
   const quality=liveGameQuality(b)-liveGameQuality(a);
   if(quality)return quality;
   return observationTime(b)-observationTime(a);
  })[0];
  selected.push({...winner,consensus:liveScoreConsensus(rows,winner)});
 }
 return selected;
}
export function summarizeLiveScoreConsensus(games:LiveGameState[]){
 const live=games.filter(x=>x.status==='LIVE');
 const high=live.filter(x=>x.consensus?.confidence==='HIGH').length;
 const medium=live.filter(x=>x.consensus?.confidence==='MEDIUM').length;
 const low=live.filter(x=>x.consensus?.confidence==='LOW').length;
 const singleSource=live.filter(x=>x.consensus?.confidence==='SINGLE_SOURCE').length;
 const activeConflicts=live.filter(x=>x.consensus?.activeConflict).length;
 const corroborated=live.filter(x=>(x.consensus?.agreeingSources||0)>=2).length;
 return {
  liveGames:live.length,
  high,
  medium,
  low,
  singleSource,
  activeConflicts,
  corroborated,
  corroborationRate:live.length?Number((corroborated/live.length).toFixed(3)):1,
  conflictRate:live.length?Number((activeConflicts/live.length).toFixed(3)):0,
  consensusWindowMs:consensusWindowMs(),
  lagToleranceMs:lagToleranceMs()
 };
}
export function evaluateLiveScoreFreshness(games:LiveGameState[],now=Date.now()){
 const live=games.filter(x=>x.status==='LIVE');
 const ages=live.map(x=>{
  const observed=Date.parse(x.observedAt);
  return Number.isFinite(observed)&&observed<=now+2000?Math.max(0,now-observed):Number.POSITIVE_INFINITY;
 });
 const maxLiveAgeMs=ages.length?Math.max(...ages):0;
 const clockCoverage=live.length?live.filter(x=>Boolean(x.clock)).length/live.length:1;
 const scoreCoverage=live.length?live.filter(scoreKnown).length/live.length:1;
 const staleLiveGames=ages.filter(x=>x>15000).length;
 let state:'IDLE'|'FAST'|'HEALTHY'|'DEGRADED'|'STALE'='IDLE';
 if(live.length){
  if(maxLiveAgeMs<=2500&&clockCoverage>=.75&&scoreCoverage>=.95)state='FAST';
  else if(maxLiveAgeMs<=6000&&clockCoverage>=.40&&scoreCoverage>=.85)state='HEALTHY';
  else if(maxLiveAgeMs<=15000&&scoreCoverage>=.70)state='DEGRADED';
  else state='STALE';
 }
 const recommendedUiRefreshMs=!live.length?uiIdleMs():state==='FAST'?uiFastMs():state==='HEALTHY'?uiLiveMs():uiDegradedMs();
 const sourceCounts=[...games.reduce((map,game)=>map.set(game.source,(map.get(game.source)||0)+1),new Map<string,number>())]
  .sort((a,b)=>b[1]-a[1])
  .map(([source,count])=>({source,count}));
 return {
  state,
  liveGames:live.length,
  maxLiveAgeMs:Number.isFinite(maxLiveAgeMs)?Math.round(maxLiveAgeMs):null,
  clockCoverage:Number(clockCoverage.toFixed(3)),
  scoreCoverage:Number(scoreCoverage.toFixed(3)),
  staleLiveGames,
  selectedSourceCount:sourceCounts.length,
  sourceCounts,
  recommendedUiRefreshMs
 };
}
async function withinDeadline<T>(request:Promise<T>,deadline:number,label:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([request,new Promise<T>((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label} deadline reached`)),Math.max(0,deadline-Date.now()));
  })]);
 }finally{if(timer)clearTimeout(timer)}
}

async function json(url:string,deadline:number){
 const remaining=deadline-Date.now();
 if(remaining<=0)throw new Error('Score source deadline reached');
 const controller=new AbortController();
 const requestDeadline=Math.min(deadline,Date.now()+timeoutMs());
 const timer=setTimeout(()=>controller.abort(),Math.max(0,requestDeadline-Date.now()));
 try{
  // Bound body parsing as well as fetch, even if a transport ignores abort.
  return await withinDeadline((async()=>{
   const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/114 live-score-mesh'}});
   if(!res.ok)throw new Error('HTTP '+res.status);
   return await res.json() as unknown;
  })(),requestDeadline,'Score source');
 }finally{clearTimeout(timer);controller.abort()}
}

export function parseEspnLiveGames(payload:unknown,league:string):LiveGameState[]{
 const root=obj(payload);
 return arr(root.events).map(raw=>{
  const e=obj(raw);
  const competition=obj(arr(e.competitions)[0]);
  const competitors=arr(competition.competitors).map(obj);
  const home=competitors.find(x=>str(x.homeAway).toLowerCase()==='home')||competitors[0]||{};
  const away=competitors.find(x=>str(x.homeAway).toLowerCase()==='away')||competitors[1]||{};
  const status=obj(e.status);
  const type=obj(status.type);
  const detail=str(type.detail)||str(type.description)||str(type.shortDetail)||str(status.displayClock);
  const clock=str(status.displayClock)||str(type.shortDetail)||undefined;
  const periodRaw=status.period??competition.period;
  return {
   id:str(e.id)||str(competition.id),
   sport:league,
   league,
   source:'espn-public',
   status:normalizeStatus(str(type.state)||detail),
   detail,
   clock,
   period:periodRaw==null?undefined:String(periodRaw),
   startTime:str(e.date)||str(competition.date)||undefined,
   home:{name:teamName(home.team),score:num(home.score)},
   away:{name:teamName(away.team),score:num(away.score)},
   observedAt:new Date().toISOString()
  };
 }).filter(x=>x.id&&x.home.name!=='Unknown'&&x.away.name!=='Unknown');
}

export function parseEspnCdnGame(payload:unknown,base:LiveGameState):LiveGameState|null{
 const root=obj(payload),pack=obj(root.gamepackageJSON),header=obj(pack.header);
 const competition=obj(arr(header.competitions)[0]);
 const competitors=arr(competition.competitors).map(obj);
 const home=competitors.find(x=>str(x.homeAway).toLowerCase()==='home');
 const away=competitors.find(x=>str(x.homeAway).toLowerCase()==='away');
 const status=obj(competition.status),type=obj(status.type);
 if(!home||!away)return null;
 const detail=str(type.detail)||str(type.description)||str(type.shortDetail)||str(status.displayClock)||base.detail;
 return {
  ...base,
  source:'espn-cdn',
  status:normalizeStatus(str(type.state)||detail||base.status),
  detail,
  clock:str(status.displayClock)||base.clock,
  period:status.period==null?base.period:String(status.period),
  home:{...base.home,score:num(home.score)??base.home.score},
  away:{...base.away,score:num(away.score)??base.away.score},
  observedAt:new Date().toISOString()
 };
}

export function parseNhlGames(payload:unknown):LiveGameState[]{
 return arr(obj(payload).games).map(raw=>{
  const g=obj(raw),home=obj(g.homeTeam),away=obj(g.awayTeam),clock=obj(g.clock),period=obj(g.periodDescriptor);
  const gameState=str(g.gameState)||str(g.gameScheduleState);
  const state=/final|off/i.test(gameState)?'FINAL':/live|crit/i.test(gameState)?'LIVE':/delay|postpon/i.test(gameState)?'DELAYED':'SCHEDULED';
  return {
   id:String(g.id||''),
   sport:'NHL',league:'NHL',source:'nhl-web',
   status:state as LiveGameState['status'],
   detail:[str(period.periodType),clock.timeRemaining?String(clock.timeRemaining):''].filter(Boolean).join(' '),
   clock:clock.timeRemaining?String(clock.timeRemaining):undefined,
   period:g.period==null?undefined:String(g.period),
   startTime:str(g.startTimeUTC)||str(g.gameDate)||undefined,
   home:{name:str(obj(home.placeName).default)||str(obj(home.commonName).default)||str(home.abbrev)||'Home',score:num(home.score)},
   away:{name:str(obj(away.placeName).default)||str(obj(away.commonName).default)||str(away.abbrev)||'Away',score:num(away.score)},
   observedAt:new Date().toISOString()
  };
 }).filter(x=>x.id);
}

export function parseMlbSchedule(payload:unknown):LiveGameState[]{
 const out:LiveGameState[]=[];
 for(const date of arr(obj(payload).dates)){
  for(const raw of arr(obj(date).games)){
   const g=obj(raw),teams=obj(g.teams),home=obj(teams.home),away=obj(teams.away),status=obj(g.status),linescore=obj(g.linescore);
   const abstract=str(status.abstractGameState)||str(status.detailedState);
   const state=/final|completed/i.test(abstract)?'FINAL':/live|in progress/i.test(abstract)?'LIVE':/delay|postpon/i.test(abstract)?'DELAYED':'SCHEDULED';
   const inning=linescore.currentInning;
   const half=str(linescore.inningHalf)||str(linescore.inningState);
   out.push({
    id:String(g.gamePk||''),
    sport:'MLB',league:'MLB',source:'mlb-statsapi',
    status:state as LiveGameState['status'],
    detail:[half,inning?String(inning):'',str(status.detailedState)].filter(Boolean).join(' '),
    period:inning==null?undefined:String(inning),
    startTime:str(g.gameDate)||undefined,
    home:{name:teamName(obj(home.team)),score:num(home.score)},
    away:{name:teamName(obj(away.team)),score:num(away.score)},
    observedAt:new Date().toISOString()
   });
  }
 }
 return out.filter(x=>x.id);
}

async function cached(
 key:string,
 liveTtl:number,
 idleTtl:number,
 load:()=>Promise<LiveGameState[]>
){
 const now=Date.now();
 const hit=cache.get(key);
 const ttl=hit?.games.some(x=>x.status==='LIVE')?liveTtl:idleTtl;
 if(hit&&now>=hit.at&&now-hit.at<ttl)return hit.games;
 const pending=inFlight.get(key);
 if(pending)return pending;
 const request=(async()=>{
  try{
   const games=await load();
   cache.set(key,{at:Date.now(),games});
   sourceErrors.delete(key);
   return games;
  }catch(error){
   sourceErrors.set(key,error instanceof Error?error.message:'request failed');
   const stale=cache.get(key);
   if(stale&&Date.now()>=stale.at&&Date.now()-stale.at<=staleFallbackMs())return stale.games;
   throw error;
  }finally{
   inFlight.delete(key);
  }
 })();
 inFlight.set(key,request);
 return request;
}

async function espnCdn(base:LiveGameState,label:string,league:string,deadline:number){
 const slug=ESPN_CDN_SLUG[label];
 if(!slug||base.status!=='LIVE')return base;
 const key='espn-cdn:'+label+':'+base.id;
 const games=await cached(key,espnCdnLiveTtlMs(),espnCdnLiveTtlMs(),async()=>{
  const suffix=slug==='soccer'?`&league=${encodeURIComponent(league)}`:'';
  const payload=await json(`https://cdn.espn.com/core/${slug}/game?xhr=1&gameId=${encodeURIComponent(base.id)}${suffix}`,deadline);
  const parsed=parseEspnCdnGame(payload,base);
  return parsed?[parsed]:[];
 });
 return games[0]||base;
}

async function espn(sport:string,league:string,label:string,deadline:number){
 const key='espn:'+sport+':'+league;
 return cached(key,espnLiveTtlMs(),espnIdleTtlMs(),async()=>{
  const date=new Date().toISOString().slice(0,10).replaceAll('-','');
  const payload=await json(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${date}`,deadline);
  // Reuse the exact scoreboard response. No odds request, source-time inference,
  // model calculation or persistence occurs on this display-only path.
  const observedAt=new Date().toISOString();
  const referenceRows=arr(obj(payload).events).slice(0,200)
   .flatMap(event=>normalizeEspnEmbeddedOdds(event,label,observedAt));
  const referenceMarkets=normalizeOddsPayload(referenceRows).markets
   .map(m=>({...m,sourceProviderId:'espn-core-odds'}));
  observedOddsByLeague.set(key,buildObservedOddsSnapshot(referenceMarkets));
  return parseEspnLiveGames(payload,label);
 });
}
async function nhl(deadline:number){
 return cached('nhl-native',nativeLiveTtlMs(),nativeIdleTtlMs(),async()=>parseNhlGames(await json('https://api-web.nhle.com/v1/score/now',deadline)));
}
async function mlb(deadline:number){
 return cached('mlb-native',nativeLiveTtlMs(),nativeIdleTtlMs(),async()=>{
  const date=new Date().toISOString().slice(0,10);
  return parseMlbSchedule(await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`,deadline));
 });
}

type PrimarySource={id:string;label:string;liveTtl:number;idleTtl:number;load:(deadline:number)=>Promise<LiveGameState[]>};
let collectionWarnings:string[]=[];

function primarySources():PrimarySource[]{
 // Interleave families on a cold start; later batches first visit sources
 // that did not receive an opportunity in the previous bounded batch.
 const pending=[...ESPN_LEAGUES],leagues:typeof pending=[];
 while(pending.length){
  const families=new Set<string|undefined>();
  for(let i=0;i<pending.length;){
   const family=pending[i][3];
   if(families.has(family)){i++;continue;}
   families.add(family);leagues.push(pending.splice(i,1)[0]);
  }
 }
 return [
  {id:'nhl-native',label:'NHL native',liveTtl:nativeLiveTtlMs(),idleTtl:nativeIdleTtlMs(),load:nhl},
  {id:'mlb-native',label:'MLB native',liveTtl:nativeLiveTtlMs(),idleTtl:nativeIdleTtlMs(),load:mlb},
  ...leagues.map(([sport,league,label])=>({id:'espn:'+sport+':'+league,label,
   liveTtl:espnLiveTtlMs(),idleTtl:espnIdleTtlMs(),load:(deadline:number)=>espn(sport,league,label,deadline)}))
 ];
}

async function boundedWork<T>(items:T[],deadline:number,concurrency:number,run:(item:T)=>Promise<unknown>){
 let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
  while(next<items.length&&Date.now()<deadline)await run(items[next++]);
 }));
 return next;
}

function recentGames(games:LiveGameState[],now:number){
 return games.filter(game=>{const at=Date.parse(game.observedAt);return Number.isFinite(at)&&at<=now&&now-at<=staleFallbackMs()});
}

// Pure cache read: callers can preserve observations already acquired before
// an unrelated route deadline. Original observation times are never renewed.
export function readCachedLiveScoreMesh(){
 const now=Date.now();
 const entries=[...cache.values()].filter(value=>now>=value.at&&now-value.at<=staleFallbackMs());
 const batches=entries.map(value=>recentGames(value.games,now));
 const nhlNative=batches.flat().filter(g=>g.source==='nhl-web');
 const mlbNative=batches.flat().filter(g=>g.source==='mlb-statsapi');
 const espnGames=batches.flat().filter(g=>g.source==='espn-public'||g.source==='espn-cdn');
 const specialized=[...nhlNative,...mlbNative];
 const sportScore=sportScoreSnapshot||{enabled:false,games:[]};
 const community=communitySnapshot||{games:[],warnings:[],sourceState:[]};
 const sportScoreGames=recentGames(Array.isArray(sportScore.games)?sportScore.games:[],now);
 const communityGames=recentGames(Array.isArray(community.games)?community.games:[],now);
 const games=reconcileLiveGames(specialized,espnGames,sportScoreGames as LiveGameState[],communityGames as LiveGameState[])
  .sort((a,b)=>(a.status==='LIVE'?0:a.status==='SCHEDULED'?1:2)-(b.status==='LIVE'?0:b.status==='SCHEDULED'?1:2)||new Date(a.startTime||0).getTime()-new Date(b.startTime||0).getTime());
 const freshness=evaluateLiveScoreFreshness(games);
 const consensus=summarizeLiveScoreConsensus(games);
 const consensusWarnings=games
  .filter(x=>x.status==='LIVE'&&x.consensus?.activeConflict)
  .slice(0,8)
  .map(x=>`live score conflict ${x.away.name} @ ${x.home.name}: selected ${x.source}; ${x.consensus?.reasons.join('; ')}`);
 const sourceState=(collection?.sources||primarySources().map(source=>({id:source.id,label:source.label,status:'DEFERRED' as const,gameCount:0,referenceCount:0})))
  .map(source=>{
   const hit=cache.get(source.id);
   const referenceCount=mergeObservedOddsSnapshots([observedOddsByLeague.get(source.id)],now).referenceCount;
   return {...source,gameCount:hit?recentGames(hit.games,now).length:0,referenceCount,
    ...(hit?{observedAt:new Date(hit.at).toISOString()}:{})};
  });
 const acquisition:MeshCollection={partial:!collection||collection.partial||sourceState.some(s=>s.status==='FAILED'||s.status==='DEFERRED'),
  deadlineReached:collection?.deadlineReached||false,deadlineMs:collection?.deadlineMs??meshDeadlineMs(),
  concurrency:collection?.concurrency??meshConcurrency(),sources:sourceState};
 const evidenceTimes=[...entries.map(value=>value.at),...sportScoreGames.map(game=>Date.parse(game.observedAt)),...communityGames.map(game=>Date.parse(game.observedAt)),
  ...[...observedOddsByLeague.values()].flatMap(snapshot=>snapshot.referenceQuotes.map(quote=>Date.parse(quote.quoteObservedAt)))].filter(at=>Number.isFinite(at)&&at<=now);
 return {
  ok:true,
  generatedAt:new Date(evidenceTimes.length?Math.max(...evidenceTimes):now).toISOString(),
  refreshMs:games.some(x=>x.status==='LIVE')?Math.min(nativeLiveTtlMs(),espnCdnLiveTtlMs()):Math.min(nativeIdleTtlMs(),espnIdleTtlMs()),
  uiRefreshMs:freshness.recommendedUiRefreshMs,
  freshness,
  consensus,
  sourceMode:'adaptive-multi-source-free-first-consensus',
  coverage:sportCoverageSummary(),
  transport:{requestCoalescing:true,staleIfErrorMs:staleFallbackMs(),inFlight:inFlight.size,cacheEntries:cache.size},
  collection:acquisition,
  attribution:sportScore.enabled&&'attribution' in sportScore?sportScore.attribution:null,
  sources:[
   {id:'nhl-web',auth:'none',priority:'league-native',liveRefreshMs:nativeLiveTtlMs(),idleRefreshMs:nativeIdleTtlMs()},
   {id:'mlb-statsapi',auth:'none',priority:'league-native',liveRefreshMs:nativeLiveTtlMs(),idleRefreshMs:nativeIdleTtlMs()},
   {id:'espn-cdn',auth:'none',priority:'live-game-fast-path',liveRefreshMs:espnCdnLiveTtlMs(),idleRefreshMs:null},
   {id:'espn-public',auth:'none',priority:'broad-discovery-fallback',liveRefreshMs:espnLiveTtlMs(),idleRefreshMs:espnIdleTtlMs()},
   {id:'sportscore',auth:'none',priority:'attribution-required-backup',liveRefreshMs:60000,idleRefreshMs:60000,enabled:sportScore.enabled},
   ...community.sourceState.map(x=>({id:x.id,auth:x.id==='thesportsdb'?'shared-free-key':'optional-key',priority:'community-backup',enabled:x.ok,count:x.count}))
  ],
  liveGames:games.filter(x=>x.status==='LIVE').length,
  observedOdds:mergeObservedOddsSnapshots([...observedOddsByLeague.values()]),
  games,
  warnings:[...new Set([...consensusWarnings,...collectionWarnings,...((sportScore as any).warnings||[]),...(community.warnings||[])])].slice(0,30)
 };
}

async function acquireLiveScoreMesh(options:{deadlineMs?:number}){
 const budget=meshDeadlineMs(options.deadlineMs),deadline=Date.now()+budget,concurrency=meshConcurrency();
 const sources=primarySources();
 collection={partial:false,deadlineReached:false,deadlineMs:budget,concurrency,
  sources:sources.map(source=>({id:source.id,label:source.label,status:'DEFERRED',gameCount:0,referenceCount:0}))};
 collectionWarnings=[];
 const pending=sources.filter(source=>{
  const hit=cache.get(source.id),now=Date.now();
  const ttl=hit?.games.some(game=>game.status==='LIVE')?source.liveTtl:source.idleTtl;
  if(hit&&now>=hit.at&&now-hit.at<ttl){
   collection!.sources.find(row=>row.id===source.id)!.status='CACHED';return false;
  }
  return true;
 }).sort((a,b)=>(sourceAttempts.get(a.id)||0)-(sourceAttempts.get(b.id)||0));
 await boundedWork(pending,deadline,concurrency,async source=>{
  sourceAttempts.set(source.id,++attemptSequence);
  const state=collection!.sources.find(row=>row.id===source.id)!;
  try{
   await source.load(deadline);
   const error=sourceErrors.get(source.id);
   state.status=error?'CACHED':'FETCHED';
   if(error){state.error=error;collectionWarnings.push(`${source.label}: ${error}; original cached observation retained`);}
  }catch(error){
   state.status='FAILED';state.error=error instanceof Error?error.message:'request failed';
   collectionWarnings.push(`${source.label}: ${state.error}`);
  }
 });

 // Primary leagues get their opportunity before optional game detail or backup
 // work. This also bounds the formerly unbounded per-game CDN fan-out.
 const upgrades=ESPN_LEAGUES.flatMap(([sport,league,label])=>recentGames(cache.get('espn:'+sport+':'+league)?.games||[],Date.now())
  .filter(game=>game.status==='LIVE'&&ESPN_CDN_SLUG[label])
  .map(game=>({game,league,label,id:'espn-cdn:'+label+':'+game.id})))
  .sort((a,b)=>(sourceAttempts.get(a.id)||0)-(sourceAttempts.get(b.id)||0)).slice(0,12);
 const optional:Array<()=>Promise<unknown>>=upgrades.map(row=>async()=>{
  sourceAttempts.set(row.id,++attemptSequence);
  await espnCdn(row.game,row.label,row.league,deadline).catch(error=>collectionWarnings.push(`${row.label} game detail: ${error instanceof Error?error.message:'unavailable'}`));
 });
 optional.push(async()=>{
  try{sportScoreSnapshot=await withinDeadline(fetchSportScoreBackup(),deadline,'SportScore backup');}
  catch{collectionWarnings.push('SportScore backup deadline or request failure; primary observations retained');}
 },async()=>{
  try{communitySnapshot=await withinDeadline(fetchCommunityScoreBackups(),deadline,'Community score backup');}
  catch{collectionWarnings.push('Community score backup deadline or request failure; primary observations retained');}
 });
 await boundedWork(optional,deadline,concurrency,run=>run());
 collection.deadlineReached=Date.now()>=deadline;
 collection.partial=collection.deadlineReached||collection.sources.some(source=>source.status==='FAILED'||source.status==='DEFERRED'||source.error);
 if(collection.deadlineReached)collectionWarnings.push('Score collection deadline reached; completed sources and age-bounded cached observations are shown');
 return readCachedLiveScoreMesh();
}

export function fetchLiveScoreMesh(options:{deadlineMs?:number}={}){
 if(!meshInFlight)meshInFlight=acquireLiveScoreMesh(options).finally(()=>{meshInFlight=null});
 return meshInFlight;
}
