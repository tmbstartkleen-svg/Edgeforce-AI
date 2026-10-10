import type {ProviderConfig,ProviderFetchResult} from './types';
import {acquireSharpLease,finishSharpLease,type SharpSnapshot} from './sharedSharpFeed';

const ENDPOINT='https://api.sharpapi.io/api/v1/odds';
const BOOKS:Record<string,string>={draftkings:'DraftKings',fanduel:'FanDuel'};
const MARKETS:Record<string,string>={moneyline:'h2h',point_spread:'spreads',run_line:'spreads',puck_line:'spreads',total_points:'totals',total_goals:'totals',total_runs:'totals'};
const text=(v:unknown)=>typeof v==='string'&&v.length<=250&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():'';
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const time=(v:unknown)=>typeof v==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(v)?Date.parse(v):NaN;

export function sharpApiProvider(env:Record<string,string|undefined>=process.env):ProviderConfig|null{
 const key=env.SHARP_API_KEY?.trim();
 // An installed adapter is not a license or a working feed. Require deliberate opt-in.
 if(env.SHARP_API_ENABLED!=='true'||!key||key==='[SENSITIVE]'||/[\s\u0000-\u001f\u007f]/.test(key))return null;
 return {id:'sharp-api',name:'SharpAPI (delayed pregame)',capability:'ODDS',url:'sharp-api://pregame-main',
  apiKey:key,authHeader:'X-API-Key',authScheme:'',priority:125,timeoutMs:24000,enabled:true,
  bookmaker:'SharpAPI',maxAgeMin:5,failureThreshold:3,quarantineMin:5,marketRole:'REFERENCE',consensusWeight:1};
}

type FlatQuote={
 id:string;eventId:string;sport:string;league:string;home:string;away:string;event:string;
 market:string;selection:string;odds:number;bookmaker:string;startTime:string;pulledAt:string;
 sourceDelaySeconds:number;sourceTimestamp:string;liveEligible:false;
};
type Candidate={quote:FlatQuote;side:string;line:number|null;group:string};

export function normalizeSharpSnapshot(snapshot:SharpSnapshot,now=Date.now()){
 const candidates:Candidate[]=[];
 let rejected=0;
 const seen=new Map<string,string>();
 const blockedGroups=new Set<string>();
 for(const raw of snapshot.rows){
  const r=obj(raw),book=text(r.sportsbook),marketType=text(r.market_type),market=MARKETS[marketType];
  const id=text(r.id),eventId=text(r.event_id),home=text(r.home_team),away=text(r.away_team);
  const sport=text(r.sport),league=text(r.league),side=text(r.selection_type).toLowerCase();
  const start=time(r.event_start_time),stamp=time(r.timestamp);
  // timestamp is feed delivery time, not a certified time of the last price change.
  // Never make a cached payload younger by using the current retrieval time.
  const asOf=Math.min(stamp,snapshot.receivedAt-snapshot.delaySeconds*1000);
  const segment=text(r.market_segment);
  const groupKey=JSON.stringify([book,eventId,sport,league,home,away,start,market]);
  const badFlag=['is_active','is_stale_pregame_price','is_alternate_line','is_player_prop','is_future'].some(key=>r[key]!==undefined&&typeof r[key]!=='boolean');
  if(badFlag||!BOOKS[book]||!market||!id||!eventId||!home||!away||home===away||!sport||!league||
   r.is_live!==false||r.is_active===false||r.is_stale_pregame_price===true||r.is_main_line!==true||
   r.is_alternate_line===true||(segment&&segment!=='full_game')||r.is_player_prop===true||r.is_future===true||
   !finite(r.odds_american)||Math.abs(r.odds_american)<100||!Number.isFinite(start)||start<=now+30000||
   !Number.isFinite(stamp)||stamp>now+30000||snapshot.receivedAt>now+30000||now-asOf>300000){rejected++;blockedGroups.add(groupKey);continue;}
  const line=finite(r.line)?r.line:null;
  if((market==='h2h'&&(line!==null||!['home','away'].includes(side)))||
   (market==='spreads'&&(line===null||!['home','away'].includes(side)||!Number.isInteger(line*2)))||
   (market==='totals'&&(line===null||line<0||!['over','under'].includes(side)||!Number.isInteger(line*2)))){rejected++;blockedGroups.add(groupKey);continue;}
  // Do not relabel a player, period or draw outcome as a full-game team bet.
  const expected=side==='home'?home:side==='away'?away:side==='over'?'Over':'Under';
  if(text(r.selection).toLowerCase()!==expected.toLowerCase()){rejected++;blockedGroups.add(groupKey);continue;}
  const identity=`sharp-api:${book}:${eventId}:${id}`;
  const signature=JSON.stringify([groupKey,side,line,r.odds_american,asOf]);
  if(seen.has(identity)){rejected++;if(seen.get(identity)!==signature)blockedGroups.add(groupKey);continue;}
  seen.set(identity,signature);
  const selection=market==='h2h'?expected:market==='spreads'?`${expected} ${line!>0?'+':''}${line}`:`${expected} ${line}`;
  candidates.push({side,line,group:groupKey,quote:{
   id:identity,eventId:`sharp-api:${book}:${eventId}`,sport:league.toUpperCase(),league:league.toUpperCase(),
   home,away,event:`${away} @ ${home}`,market,selection,odds:r.odds_american,bookmaker:BOOKS[book],
   startTime:new Date(start).toISOString(),pulledAt:new Date(asOf).toISOString(),
   sourceDelaySeconds:snapshot.delaySeconds,sourceTimestamp:new Date(stamp).toISOString(),liveEligible:false,
  }});
 }
 const grouped=new Map<string,Candidate[]>();
 for(const row of candidates)grouped.set(row.group,[...(grouped.get(row.group)||[]),row]);
 const markets:FlatQuote[]=[];
 for(const group of grouped.values()){
  const market=group[0].quote.market;
  const sides=new Set(group.map(x=>x.side));
  const complete=!blockedGroups.has(group[0].group)&&group.length===2&&(market==='totals'?sides.has('over')&&sides.has('under'):sides.has('home')&&sides.has('away'))&&
   (market==='h2h'||(market==='spreads'?Math.abs(group[0].line!+group[1].line!)<1e-9:group[0].line===group[1].line));
  if(complete)markets.push(...group.map(x=>x.quote));else rejected+=group.length;
 }
 return {markets,warnings:[
  `SharpAPI pregame only; declared delivery delay at least ${snapshot.delaySeconds}s. Not suitable for live/cash-out timing; last price-change time is unavailable.`,
  ...(snapshot.truncated?['SharpAPI coverage is partial: the bounded four-page snapshot did not reach the end of the feed.']:[]),
  ...(rejected?[`SharpAPI rejected ${rejected} invalid, expired, duplicate, unsupported or incomplete outcomes.`]:[]),
 ],coverage:{complete:!snapshot.truncated,pages:snapshot.pages,receivedRows:snapshot.rows.length,acceptedRows:markets.length,rejectedRows:rejected},
 sourceDelaySeconds:snapshot.delaySeconds,liveEligible:false};
}

export function sharpRetryAfter(headers:Headers,now=Date.now()){
 const retry=headers.get('retry-after');
 if(retry){
  const seconds=/^\d+(?:\.\d+)?$/.test(retry)?Number(retry):NaN;
  const millis=Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-now;
  if(Number.isFinite(millis)&&millis>0)return Math.ceil(millis);
 }
 const reset=headers.get('x-ratelimit-reset');
 const millis=reset?Number(reset)*1000-now:NaN;
 return Number.isFinite(millis)&&millis>0?Math.ceil(millis):65000;
}

export class SharpFeedError extends Error{
 constructor(public status:number,public cooldownMs:number,message:string){super(message);}
}
async function boundedJson(response:Response){
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new SharpFeedError(502,65000,'SharpAPI did not return JSON');
 if(!response.body)throw new SharpFeedError(502,65000,'SharpAPI returned no body');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
   if(size>524288){await reader.cancel();throw new SharpFeedError(502,65000,'SharpAPI page exceeds the safe size limit');}chunks.push(chunk.value);}
 }finally{reader.releaseLock();}
 const joined=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(joined));}
 catch{throw new SharpFeedError(502,65000,'SharpAPI returned invalid JSON');}
}

export async function fetchSharpSnapshot(apiKey:string,fetcher:typeof fetch=fetch):Promise<SharpSnapshot>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),24000);
 const rows:unknown[]=[];const cursors=new Set<string>();let cursor='',delaySeconds=60,pages=0,truncated=false;
 let receivedAt=Date.now();
 try{
  for(let page=0;page<4;page++){
   const url=new URL(ENDPOINT);
   for(const [key,value] of Object.entries({sportsbook:'draftkings,fanduel',market:'main',is_live:'false',is_main_line:'true',include_futures:'false',limit:'200'}))url.searchParams.set(key,value);
   if(cursor)url.searchParams.set('cursor',cursor);
   const response=await fetcher(url,{headers:{Accept:'application/json','X-API-Key':apiKey},cache:'no-store',redirect:'error',signal:controller.signal});
   receivedAt=Math.min(receivedAt,Date.now());
   if(!response.ok){await response.body?.cancel();throw new SharpFeedError(response.status,response.status===429?sharpRetryAfter(response.headers):response.status===401||response.status===403?3600000:65000,`SharpAPI HTTP ${response.status}`);}
   const declared=response.headers.get('x-data-delay');
   if(declared!==null){const n=Number(declared);if(!declared.trim()||!Number.isFinite(n)||n<0)throw new SharpFeedError(502,65000,'Invalid SharpAPI data-delay header');delaySeconds=Math.max(delaySeconds,n);}
   const root=obj(await boundedJson(response)),pagination=obj(root.pagination);
   if(!Array.isArray(root.data)||root.data.length>200||typeof pagination.has_more!=='boolean')throw new SharpFeedError(502,65000,'Invalid SharpAPI page contract');
   if(root.data.length===0){
    const reason=obj(obj(root.meta).store).reason;
    if(reason!=='no_match'||pagination.has_more)throw new SharpFeedError(503,65000,'SharpAPI serving store is not ready');
   }
   rows.push(...root.data);pages++;
   if(!pagination.has_more){truncated=false;break;}
   truncated=true;
   if(page===3)break;
   cursor=typeof pagination.next_cursor==='string'?pagination.next_cursor:'';
   if(!cursor||cursor.length>4096||cursors.has(cursor))throw new SharpFeedError(502,65000,'Invalid SharpAPI pagination cursor');
   cursors.add(cursor);
  }
  return {schema:1,rows,receivedAt,delaySeconds,pages,truncated};
 }catch(error){
  if(error instanceof SharpFeedError)throw error;
  // Never copy response bodies, URLs, keys or transport diagnostics into public output.
  throw new SharpFeedError(502,65000,'SharpAPI transport failed or timed out');
 }finally{clearTimeout(timer);}
}

export async function fetchSharpApiBoard(config:ProviderConfig):Promise<ProviderFetchResult<unknown>>{
 const started=Date.now();
 const result={providerId:config.id,providerName:config.name,capability:config.capability,receivedAt:new Date(started).toISOString()};
 const fail=(error:string,status=503)=>({...result,ok:false,status,error,latencyMs:Date.now()-started});
 if(!config.apiKey)return fail('SharpAPI free account key is not configured');
 let lease;
 try{lease=await acquireSharpLease(config.apiKey);}catch{return fail('SharpAPI shared request budget unavailable; no upstream request made');}
 if(lease.kind==='hold')return fail(`SharpAPI shared budget is cooling down; retry after ${Math.ceil(lease.retryAfterMs/1000)}s`,429);
 let snapshot:SharpSnapshot;
 if(lease.kind==='cached')snapshot=lease.snapshot;
 else{
  try{snapshot=await fetchSharpSnapshot(config.apiKey);await finishSharpLease(lease,snapshot);}
  catch(error){
   const feed=error instanceof SharpFeedError?error:new SharpFeedError(503,65000,'SharpAPI shared cache could not commit the refresh');
   try{await finishSharpLease(lease,null,feed.cooldownMs);}catch{/* Preserve failure; never retry unbudgeted. */}
   return fail(feed.message,feed.status);
  }
 }
 const normalized=normalizeSharpSnapshot(snapshot);
 if(lease.kind==='cached'&&lease.coolingDown)normalized.warnings.push('SharpAPI is cooling down; using a bounded cached snapshot with original timestamps.');
 return {...result,ok:normalized.markets.length>0,status:200,data:normalized,latencyMs:Date.now()-started,
  ...(normalized.markets.length?{}:{error:'SharpAPI returned no complete supported future main-market pairs'})};
}
