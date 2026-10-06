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
const timeoutMs=()=>Math.max(2000,Number(process.env.ESPN_CORE_ODDS_TIMEOUT_MS||6000));
const maxLeagues=()=>Math.max(1,Math.min(12,Number(process.env.ESPN_CORE_ODDS_LEAGUES_PER_BATCH||5)));
const maxEvents=()=>Math.max(1,Math.min(40,Number(process.env.ESPN_CORE_ODDS_EVENTS_PER_LEAGUE||12)));
const bookAllow=()=>new Set((process.env.ESPN_CORE_ODDS_BOOKS||'DraftKings,FanDuel,BetMGM,Caesars,ESPN BET').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));

const PREFERRED_IDS=['nfl','ncaaf','nba','wnba','mlb','nhl','ncaam-basketball','ncaaw-basketball','mls','epl','ucl','ufc'];

function rotatingFeeds(){
 const all=[
  ...PREFERRED_IDS.map(id=>ESPN_SCOREBOARD_FEEDS.find(x=>x.id===id)).filter(Boolean),
  ...ESPN_SCOREBOARD_FEEDS.filter(x=>!PREFERRED_IDS.includes(x.id))
 ].filter((x):x is NonNullable<typeof x>=>Boolean(x?.sportSlug&&x?.leagueSlug));
 const width=Math.min(maxLeagues(),all.length);
 if(all.length<=width)return all;
 const bucket=Math.floor(Date.now()/cacheMs());
 const start=(bucket*width)%all.length;
 return Array.from({length:width},(_,i)=>all[(start+i)%all.length]);
}

async function json(url:string){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs());
 try{
  const res=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','User-Agent':'Edgeforce-AI/127 ESPN-Core-Odds'}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return await res.json();
 }finally{clearTimeout(timer)}
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
  state:state.toLowerCase()
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

async function load(){
 const started=Date.now(),rows:FlatRow[]=[],warnings:string[]=[];
 const date=new Date().toISOString().slice(0,10).replace(/-/g,'');
 for(const feed of rotatingFeeds()){
  try{
   const board=await json(`https://site.api.espn.com/apis/site/v2/sports/${feed.sportSlug}/${feed.leagueSlug}/scoreboard?dates=${date}`);
   const events=arr(obj(board).events).slice(0,maxEvents());
   for(const raw of events){
    const meta=eventMeta(raw);
    if(!meta.eventId||!meta.competitionId||!meta.startTime||!meta.home||!meta.away)continue;
    if(meta.state&&meta.state!=='pre')continue;
    try{
     const odds=await json(`https://sports.core.api.espn.com/v2/sports/${feed.sportSlug}/leagues/${feed.leagueSlug}/events/${meta.eventId}/competitions/${meta.competitionId}/odds?limit=20`);
     rows.push(...normalizeEspnOddsItems(odds,meta,feed.label,new Date().toISOString()));
    }catch(error){
     warnings.push(`${feed.label} ${meta.eventId}: ${error instanceof Error?error.message:'odds request failed'}`);
    }
   }
  }catch(error){
   warnings.push(`${feed.label}: ${error instanceof Error?error.message:'scoreboard request failed'}`);
  }
 }
 return {at:Date.now(),rows,latencyMs:Date.now()-started,warnings:[...new Set(warnings)].slice(0,20)};
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
