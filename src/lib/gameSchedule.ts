import {ESPN_SCOREBOARD_FEEDS} from './sportRegistry';
import {normalizeEspnOddsItems} from './providers/espnCoreOdds';

export const SCHEDULE_BATCH_SIZE=7;
export type ScheduleGame={id:string;sport:string;startTime:string;home:string;away:string;homeScore:string;awayScore:string;status:string;state:string;venue:string;quotes:{selection:string;market:string;odds:number;bookmaker:string}[]};
export type ScheduleFeed={id:string;label:string;ok:boolean;games:number;error?:string;truncated?:boolean};
export type ScheduleResult={date:string;games:ScheduleGame[];feeds:ScheduleFeed[];updatedAt:string};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'?v as Record<string,unknown>:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const string=(v:unknown)=>typeof v==='string'?v:'';
export function easternDay(offset=0,now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 const date=new Date(`${get('year')}-${get('month')}-${get('day')}T12:00:00Z`);
 date.setUTCDate(date.getUTCDate()+offset);
 return date.toISOString().slice(0,10);
}
export function normalizeSchedule(payload:unknown,label:string,date:string):ScheduleGame[]{
 const games:ScheduleGame[]=[];
 for(const raw of list(object(payload).events)){
  const event=object(raw);
  for(const entry of list(event.competitions)){
   const competition=object(entry),teams=list(competition.competitors).map(object);
   const name=(t:Record<string,unknown>)=>{const n=object(t.team),a=object(t.athlete);return string(n.displayName)||string(a.displayName)||string(t.displayName);};
   const home=teams.find(t=>t.homeAway==='home')||teams[0]||{},away=teams.find(t=>t.homeAway==='away')||teams[1]||{};
   const startTime=string(competition.date)||string(event.date);
   if(!startTime||!Number.isFinite(Date.parse(startTime))||easternDay(0,Date.parse(startTime))!==date)continue;
   const type=object(object(competition.status||event.status).type);
   const id=string(competition.id)||string(event.id);
   const quotes=normalizeEspnOddsItems({items:list(competition.odds)},{eventId:id,startTime,home:name(home),away:name(away)},label);
   games.push({id:`${label}:${id}`,sport:label,startTime,home:name(home)||'TBD',away:name(away)||'TBD',homeScore:string(home.score),awayScore:string(away.score),status:string(type.shortDetail)||string(type.description)||'Scheduled',state:string(type.state)||'pre',venue:string(object(competition.venue).fullName),quotes});
  }
 }
 return [...new Map(games.map(g=>[g.id,g])).values()].sort((a,b)=>a.startTime.localeCompare(b.startTime));
}
const cache=new Map<string,{at:number;result:ScheduleResult}>();
const inflight=new Map<string,Promise<ScheduleResult>>();
export async function loadSchedule(date:string,batch:number,sport?:string):Promise<ScheduleResult>{
 const selected=sport?ESPN_SCOREBOARD_FEEDS.filter(f=>f.id===sport):ESPN_SCOREBOARD_FEEDS.slice(batch*SCHEDULE_BATCH_SIZE,(batch+1)*SCHEDULE_BATCH_SIZE);
 const key=`${date}:${sport||batch}`;
 const cached=cache.get(key);
 if(cached&&Date.now()-cached.at<60000)return cached.result;
 if(inflight.has(key))return inflight.get(key)!;
 const task=(async()=>{
  const games:ScheduleGame[]=[],feeds:ScheduleFeed[]=[];
  await Promise.all(selected.map(async feed=>{
   try{
    // ESPN's combined FBS/FCS query returns empty event objects. Fetch each division.
    const groups=feed.id==='ncaaf'?['80','81']:['ncaam-basketball','ncaaw-basketball'].includes(feed.id)?['50']:[''];
    const outcomes=await Promise.allSettled(groups.map(async group=>{
     const query=new URLSearchParams({dates:date.replaceAll('-',''),limit:'200'});
     if(group)query.set('groups',group);
     const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/${feed.sportSlug}/${feed.leagueSlug}/scoreboard?${query}`,{signal:AbortSignal.timeout(6000),cache:'no-store'});
     if(!response.ok)throw new Error(`HTTP ${response.status}`);
     const payload=await response.json();
     const rawEvents=list(object(payload).events);
     if(rawEvents.some(raw=>!list(object(raw).competitions).length))throw new Error('Incomplete schedule entries received');
     return {rows:normalizeSchedule(payload,feed.label,date),truncated:rawEvents.length>=200};
    }));
    const successful=outcomes.filter((r):r is PromiseFulfilledResult<{rows:ScheduleGame[];truncated:boolean}>=>r.status==='fulfilled');
    const failures=outcomes.filter((r):r is PromiseRejectedResult=>r.status==='rejected').map(r=>r.reason instanceof Error?r.reason.message:'Feed failed');
    const rows=[...new Map(successful.flatMap(r=>r.value.rows).map(g=>[g.id,g])).values()];
    games.push(...rows);feeds.push({id:feed.id,label:feed.label,ok:successful.length>0,games:rows.length,error:failures.length?failures.join('; '):undefined,truncated:successful.some(r=>r.value.truncated)});
   }catch(error){feeds.push({id:feed.id,label:feed.label,ok:false,games:0,error:error instanceof Error?error.message:'Feed failed'});}
  }));
  const result={date,games:games.sort((a,b)=>a.startTime.localeCompare(b.startTime)),feeds,updatedAt:new Date().toISOString()};
  if(cache.size>=300)cache.delete(cache.keys().next().value!);
  cache.set(key,{at:Date.now(),result});return result;
 })().finally(()=>inflight.delete(key));
 inflight.set(key,task);return task;
}
