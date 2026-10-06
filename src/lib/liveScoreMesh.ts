import {ESPN_SCOREBOARD_FEEDS,sportCoverageSummary} from './sportRegistry';
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
};

type Cached={at:number;games:LiveGameState[]};
const cache=new Map<string,Cached>();
const inFlight=new Map<string,Promise<LiveGameState[]>>();
const nativeLiveTtlMs=()=>Math.max(750,Number(process.env.LIVE_SCORE_NATIVE_LIVE_CACHE_MS||1000));
const nativeIdleTtlMs=()=>Math.max(nativeLiveTtlMs(),Number(process.env.LIVE_SCORE_NATIVE_IDLE_CACHE_MS||15000));
const espnCdnLiveTtlMs=()=>Math.max(750,Number(process.env.LIVE_SCORE_ESPN_CDN_LIVE_CACHE_MS||1000));
const espnLiveTtlMs=()=>Math.max(1500,Number(process.env.LIVE_SCORE_ESPN_LIVE_CACHE_MS||3000));
const espnIdleTtlMs=()=>Math.max(espnLiveTtlMs(),Number(process.env.LIVE_SCORE_ESPN_IDLE_CACHE_MS||30000));
const staleFallbackMs=()=>Math.max(30000,Number(process.env.LIVE_SCORE_STALE_FALLBACK_MS||120000));
const timeoutMs=()=>Math.max(1500,Number(process.env.LIVE_SCORE_TIMEOUT_MS||5000));

const ESPN_LEAGUES=ESPN_SCOREBOARD_FEEDS
 .filter(x=>x.sportSlug&&x.leagueSlug)
 .map(x=>[x.sportSlug!,x.leagueSlug!,x.label] as const);


const ESPN_CDN_SLUG:Record<string,string>={
 NFL:'nfl',NCAAF:'college-football',NBA:'nba',WNBA:'wnba',NCAAB:'mens-college-basketball',
 MLB:'mlb',NHL:'nhl',MLS:'soccer',NWSL:'soccer',EPL:'soccer',LaLiga:'soccer',Bundesliga:'soccer','Serie A':'soccer','Ligue 1':'soccer',UCL:'soccer','Europa League':'soccer','FIFA World Cup':'soccer',"NCAA Men's Soccer":'soccer',"NCAA Women's Soccer":'soccer'
};

function obj(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}}
function arr(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function str(v:unknown){return typeof v==='string'?v:''}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:null}
function teamName(v:unknown){const t=obj(v);return str(t.displayName)||str(t.shortDisplayName)||str(t.name)||str(t.location)||str(t.abbreviation)||'Unknown'}
function normalizeStatus(v:string){
 const s=v.toLowerCase();
 if(/final|post/.test(s))return 'FINAL' as const;
 if(/in progress|live|halftime|end period|intermission/.test(s))return 'LIVE' as const;
 if(/delay|postpon/.test(s))return 'DELAYED' as const;
 if(/pre|scheduled/.test(s))return 'SCHEDULED' as const;
 return 'UNKNOWN' as const;
}
async function json(url:string){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/114 live-score-mesh'}});
  if(!res.ok)throw new Error('HTTP '+res.status);
  return await res.json() as unknown;
 }finally{clearTimeout(timer)}
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
 if(hit&&now-hit.at<ttl)return hit.games;
 const pending=inFlight.get(key);
 if(pending)return pending;
 const request=(async()=>{
  try{
   const games=await load();
   cache.set(key,{at:Date.now(),games});
   return games;
  }catch(error){
   const stale=cache.get(key);
   if(stale&&Date.now()-stale.at<=staleFallbackMs())return stale.games;
   throw error;
  }finally{
   inFlight.delete(key);
  }
 })();
 inFlight.set(key,request);
 return request;
}

async function espnCdn(base:LiveGameState,label:string,league:string){
 const slug=ESPN_CDN_SLUG[label];
 if(!slug||base.status!=='LIVE')return base;
 const key='espn-cdn:'+label+':'+base.id;
 const games=await cached(key,espnCdnLiveTtlMs(),espnCdnLiveTtlMs(),async()=>{
  const suffix=slug==='soccer'?`&league=${encodeURIComponent(league)}`:'';
  const payload=await json(`https://cdn.espn.com/core/${slug}/game?xhr=1&gameId=${encodeURIComponent(base.id)}${suffix}`);
  const parsed=parseEspnCdnGame(payload,base);
  return parsed?[parsed]:[];
 });
 return games[0]||base;
}

async function espn(sport:string,league:string,label:string){
 const key='espn:'+league;
 const board=await cached(key,espnLiveTtlMs(),espnIdleTtlMs(),async()=>{
  const date=new Date().toISOString().slice(0,10).replaceAll('-','');
  const payload=await json(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${date}`);
  return parseEspnLiveGames(payload,label);
 });
 return Promise.all(board.map(game=>espnCdn(game,label,league).catch(()=>game)));
}
async function nhl(){
 return cached('nhl-native',nativeLiveTtlMs(),nativeIdleTtlMs(),async()=>parseNhlGames(await json('https://api-web.nhle.com/v1/score/now')));
}
async function mlb(){
 return cached('mlb-native',nativeLiveTtlMs(),nativeIdleTtlMs(),async()=>{
  const date=new Date().toISOString().slice(0,10);
  return parseMlbSchedule(await json(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore`));
 });
}

function merge(primary:LiveGameState[],fallback:LiveGameState[]){
 const out=[...primary];
 const keys=new Set(primary.map(x=>[x.league,x.home.name,x.away.name].join('|').toLowerCase()));
 for(const game of fallback){
  const key=[game.league,game.home.name,game.away.name].join('|').toLowerCase();
  if(!keys.has(key))out.push(game);
 }
 return out;
}

export async function fetchLiveScoreMesh(){
 const settled=await Promise.allSettled([
  nhl(),mlb(),
  ...ESPN_LEAGUES.map(([sport,league,label])=>espn(sport,league,label))
 ]);
 const warnings:string[]=[];
 const batches:LiveGameState[][]=[];
 settled.forEach((r,i)=>{
  if(r.status==='fulfilled')batches.push(r.value);
  else warnings.push(`source-${i}: ${r.reason instanceof Error?r.reason.message:'request failed'}`);
 });
 const nhlNative=batches.find(x=>x.some(g=>g.source==='nhl-web'))||[];
 const mlbNative=batches.find(x=>x.some(g=>g.source==='mlb-statsapi'))||[];
 const espnGames=batches.flat().filter(g=>g.source==='espn-public');
 const specialized=[...nhlNative,...mlbNative];
 const games=merge(specialized,espnGames)
  .sort((a,b)=>(a.status==='LIVE'?0:a.status==='SCHEDULED'?1:2)-(b.status==='LIVE'?0:b.status==='SCHEDULED'?1:2)||new Date(a.startTime||0).getTime()-new Date(b.startTime||0).getTime());
 return {
  ok:true,
  generatedAt:new Date().toISOString(),
  refreshMs:games.some(x=>x.status==='LIVE')?Math.min(nativeLiveTtlMs(),espnCdnLiveTtlMs()):Math.min(nativeIdleTtlMs(),espnIdleTtlMs()),
  uiRefreshMs:1000,
  sourceMode:'adaptive-multi-source-no-key',
  coverage:sportCoverageSummary(),
  transport:{requestCoalescing:true,staleIfErrorMs:staleFallbackMs(),inFlight:inFlight.size,cacheEntries:cache.size},
  sources:[
   {id:'nhl-web',auth:'none',priority:'league-native',liveRefreshMs:nativeLiveTtlMs(),idleRefreshMs:nativeIdleTtlMs()},
   {id:'mlb-statsapi',auth:'none',priority:'league-native',liveRefreshMs:nativeLiveTtlMs(),idleRefreshMs:nativeIdleTtlMs()},
   {id:'espn-cdn',auth:'none',priority:'live-game-fast-path',liveRefreshMs:espnCdnLiveTtlMs(),idleRefreshMs:null},
   {id:'espn-public',auth:'none',priority:'broad-discovery-fallback',liveRefreshMs:espnLiveTtlMs(),idleRefreshMs:espnIdleTtlMs()}
  ],
  liveGames:games.filter(x=>x.status==='LIVE').length,
  games,
  warnings:[...new Set(warnings)].slice(0,20)
 };
}
