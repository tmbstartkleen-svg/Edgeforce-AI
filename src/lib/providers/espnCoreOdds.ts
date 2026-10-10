import type {ProviderConfig,ProviderFetchResult} from './types';
import {ESPN_SCOREBOARD_FEEDS} from '../sportRegistry';

type FlatRow={
 id:string; eventId:string; sport:string; league:string; event:string;
 home:string; away:string; selection:string; market:string; startTime:string;
 odds:number; bookmaker:string; pulledAt:string; sourceTimestamp:string;
 liveEligible:false;
};

type Cached={at:number;rows:FlatRow[];latencyMs:number;warnings:string[]};
let cache:Cached|null=null;
let inFlight:Promise<Cached>|null=null;

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null};
const cacheMs=()=>Math.max(60000,Number(process.env.ESPN_CORE_ODDS_CACHE_MS||120000));
// A single Worker invocation has a shared subrequest budget. Reserve capacity for
// database work, health reporting, and other provider calls in the same cron.
const maxRequests=()=>Math.max(1,Math.min(30,Number(process.env.ESPN_CORE_ODDS_MAX_REQUESTS||(process.env.DEPLOYMENT_PLATFORM==='cloudflare'?8:24))));
const bookAllow=()=>new Set((process.env.ESPN_CORE_ODDS_BOOKS||'DraftKings,FanDuel,BetMGM,Caesars,ESPN BET').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));

const GAP_PRIORITY_IDS=[
 'ncaaf',
 'nfl',
 'nhl',
 'mlb',
 'nba',
 'wnba',
 'ncaam-basketball',
 'ncaaw-basketball',
 'mls',
 'epl',
 'laliga',
 'bundesliga',
 'serie-a',
 'ligue-1',
 'ucl',
 'uel'
];

const SUPPLEMENTAL_IDS=[
 'nfl',
 'nhl',
 'mlb',
 'ufc'
];

function orderedFeeds(){
 const preferred=[...new Set([...GAP_PRIORITY_IDS,...SUPPLEMENTAL_IDS])];
 return [
  ...preferred.map(id=>ESPN_SCOREBOARD_FEEDS.find(x=>x.id===id)).filter(Boolean),
  ...ESPN_SCOREBOARD_FEEDS.filter(x=>!preferred.includes(x.id))
 ].filter((x):x is NonNullable<typeof x>=>Boolean(x?.sportSlug&&x?.leagueSlug));
}

function eventMeta(raw:unknown){
 const event=obj(raw),competition=obj(arr(event.competitions)[0]);
 const competitors=arr(competition.competitors).map(obj);
 const home=competitors.find(x=>str(x.homeAway).toLowerCase()==='home')||{};
 const away=competitors.find(x=>str(x.homeAway).toLowerCase()==='away')||{};
 const teamName=(x:Record<string,unknown>)=>{
  const team=obj(x.team);
  return str(team.displayName)||str(team.shortDisplayName)||str(team.name);
 };
 const state=str(obj(obj(competition.status).type).state)||str(obj(obj(event.status).type).state);
 return {
  eventId:str(event.id),
  competitionId:str(competition.id)||str(event.id),
  startTime:str(competition.date)||str(event.date),
  home:teamName(home),
  away:teamName(away),
  state:state.toLowerCase(),
  embeddedOdds:arr(competition.odds)
 };
}

function americanOk(v:number|null){
 return v!==null&&Number.isFinite(v)&&Math.abs(v)>=100;
}

export function normalizeEspnOddsItems(
 payload:unknown,
 meta:{eventId:string;startTime:string;home:string;away:string},
 sportLabel:string,
 observedAt=new Date().toISOString()
):FlatRow[]{
 const out:FlatRow[]=[];
 const allow=bookAllow();
 for(const raw of arr(obj(payload).items)){
  const item=obj(raw),provider=obj(item.provider);
  const bookmaker=str(provider.name)||str(provider.displayName);
  if(!bookmaker||!allow.has(bookmaker.toLowerCase()))continue;
  const homeOdds=obj(item.homeTeamOdds),awayOdds=obj(item.awayTeamOdds);
  const homeMl=num(homeOdds.moneyLine),awayMl=num(awayOdds.moneyLine);
  const spreadRaw=num(item.spread);
  const total=num(item.overUnder);
  const event=`${meta.away} @ ${meta.home}`;
  const base={eventId:meta.eventId,sport:sportLabel,league:sportLabel,event,home:meta.home,away:meta.away,startTime:meta.startTime,bookmaker,pulledAt:observedAt,sourceTimestamp:observedAt,liveEligible:false as const};

  if(americanOk(homeMl)&&americanOk(awayMl)){
   out.push({...base,id:`espn:${meta.eventId}:h2h:home:${bookmaker}`,selection:meta.home,market:'h2h',odds:homeMl!});
   out.push({...base,id:`espn:${meta.eventId}:h2h:away:${bookmaker}`,selection:meta.away,market:'h2h',odds:awayMl!});
  }

  const spreadAbs=spreadRaw===null?null:Math.abs(spreadRaw);
  const homeSpreadOdds=num(homeOdds.spreadOdds),awaySpreadOdds=num(awayOdds.spreadOdds);
  if(spreadAbs!==null&&spreadAbs>0&&americanOk(homeSpreadOdds)&&americanOk(awaySpreadOdds)){
   const homeFavorite=homeOdds.favorite===true,awayFavorite=awayOdds.favorite===true;
   const homePoint=homeFavorite?-spreadAbs:awayFavorite?spreadAbs:spreadRaw!;
   const awayPoint=-homePoint;
   out.push({...base,id:`espn:${meta.eventId}:spreads:home:${bookmaker}`,selection:`${meta.home} ${homePoint>0?'+':''}${homePoint}`,market:'spreads',odds:homeSpreadOdds!});
   out.push({...base,id:`espn:${meta.eventId}:spreads:away:${bookmaker}`,selection:`${meta.away} ${awayPoint>0?'+':''}${awayPoint}`,market:'spreads',odds:awaySpreadOdds!});
  }

  const overOdds=num(item.overOdds),underOdds=num(item.underOdds);
  if(total!==null&&total>0&&americanOk(overOdds)&&americanOk(underOdds)){
   out.push({...base,id:`espn:${meta.eventId}:totals:over:${bookmaker}`,selection:`Over ${total}`,market:'totals',odds:overOdds!});
   out.push({...base,id:`espn:${meta.eventId}:totals:under:${bookmaker}`,selection:`Under ${total}`,market:'totals',odds:underOdds!});
  }
 }
 return out;
}

export function normalizeEspnEmbeddedOdds(raw:unknown,sportLabel:string,observedAt=new Date().toISOString()):FlatRow[]{
 const meta=eventMeta(raw);
 if(!meta.eventId||!meta.competitionId||!meta.startTime||!meta.home||!meta.away)return [];
 if(meta.state&&meta.state!=='pre')return [];
 if(!meta.embeddedOdds.length)return [];
 return normalizeEspnOddsItems({items:meta.embeddedOdds},meta,sportLabel,observedAt);
}

function dateKey(offsetDays=0){
 return new Date(Date.now()+offsetDays*86400000).toISOString().slice(0,10).replace(/-/g,'');
}

export function mergeEspnCoverage(previous:FlatRow[],incoming:FlatRow[],now=Date.now()){
 const rows=new Map<string,FlatRow>();
 for(const row of [...previous,...incoming]){
  if(new Date(row.startTime).getTime()<=now)continue;
  if(now-new Date(row.pulledAt).getTime()>240000)continue;
  rows.set(row.id,row);
 }
 return [...rows.values()];
}
async function load(){
 const started=Date.now(),rows:FlatRow[]=[],warnings:string[]=[];
 const all=orderedFeeds();
 let detailRequests=Math.min(2,Math.max(0,maxRequests()-1));
 const width=Math.min(all.length,Math.max(1,maxRequests()-detailRequests));
 const bucket=Math.floor(Date.now()/cacheMs());
 const selected=all.slice(0,Math.min(4,width));
 const tail=all.slice(selected.length);
 for(let i=0;i<width-selected.length&&tail.length;i++)selected.push(tail[(bucket*(width-4)+i)%tail.length]);
 // One scoreboard request per league, concurrent and inside the provider deadline.
 // Embedded prices are used only when complete; missing prices are never invented.
 await Promise.all(selected.map(async feed=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),2200);
  try{
   const res=await fetch(`https://site.api.espn.com/apis/site/v2/sports/${feed.sportSlug}/${feed.leagueSlug}/scoreboard?dates=${dateKey()}-${dateKey(7)}&limit=100`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
   if(!res.ok)throw new Error(`HTTP ${res.status}`);
   const payload=await res.json();
   for(const raw of arr(obj(payload).events)){
    const meta=eventMeta(raw);
    if(meta.state&&meta.state!=='pre')continue;
    const embedded=normalizeEspnEmbeddedOdds(raw,feed.label);
    rows.push(...embedded);
    if(!embedded.length&&detailRequests>0&&meta.eventId&&meta.home&&meta.away){
     detailRequests--;
     const oddsRes=await fetch(`https://sports.core.api.espn.com/v2/sports/${feed.sportSlug}/leagues/${feed.leagueSlug}/events/${meta.eventId}/competitions/${meta.competitionId}/odds?limit=20`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
     if(oddsRes.ok)rows.push(...normalizeEspnOddsItems(await oddsRes.json(),meta,feed.label));
    }
   }
  }catch(error){warnings.push(`${feed.label}: ${error instanceof Error?error.message:'scoreboard failed'}`)}
  finally{clearTimeout(timer)}
 }));
 return {at:Date.now(),rows:mergeEspnCoverage(cache?.rows||[],rows),latencyMs:Date.now()-started,warnings};
}

export function espnCoreOddsProvider(env:Record<string,string|undefined>=process.env):ProviderConfig|null{
 if(env.ESPN_CORE_ODDS_ENABLED==='false')return null;
 return {
  id:'espn-core-odds',name:'ESPN Core Odds',capability:'ODDS',url:'espn-core://odds',
  priority:Math.max(1,Number(env.ESPN_CORE_ODDS_PRIORITY||95)),timeoutMs:6000,enabled:true,
  bookmaker:'ESPN Core',maxAgeMin:5,failureThreshold:3,quarantineMin:2,marketRole:'REFERENCE',consensusWeight:.85
 };
}

export async function fetchEspnCoreOdds(config:ProviderConfig):Promise<ProviderFetchResult<unknown>>{
 const base={providerId:config.id,providerName:config.name,capability:config.capability,receivedAt:new Date().toISOString()};
 if(cache&&Date.now()-cache.at<cacheMs())return {...base,ok:cache.rows.length>0,latencyMs:0,status:200,data:cache.rows,error:cache.rows.length?undefined:'ESPN Core odds cache contains no complete supported markets'};
 if(!inFlight)inFlight=load().finally(()=>{inFlight=null});
 try{
  const result=await inFlight;cache=result;
  return {...base,ok:result.rows.length>0,latencyMs:result.latencyMs,status:200,data:result.rows,error:result.rows.length?undefined:`ESPN Core odds produced no complete supported markets${result.warnings.length?' | '+result.warnings.join('; '):''}`};
 }catch(error){
  if(cache&&Date.now()-cache.at<cacheMs()*3)return {...base,ok:cache.rows.length>0,latencyMs:Date.now()-cache.at,status:200,data:cache.rows,error:'ESPN Core odds refresh failed; using bounded cached real rows'};
  return {...base,ok:false,latencyMs:0,error:error instanceof Error?error.message:'ESPN Core odds request failed'};
 }
}
