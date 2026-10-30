export const SCHEDULE_LEAGUES:Record<string,string>={NBA:'basketball/nba',WNBA:'basketball/wnba',NCAAB:'basketball/mens-college-basketball',NFL:'football/nfl',NCAAF:'football/college-football',NHL:'hockey/nhl',MLB:'baseball/mlb',EPL:'soccer/eng.1','La Liga - Spain':'soccer/esp.1','Bundesliga - Germany':'soccer/ger.1','Serie A - Italy':'soccer/ita.1',MLS:'soccer/usa.1'};
export function normalizeSchedule(body:any,league:string,now:number){
 if(!Array.isArray(body?.events))throw new Error('Schedule format unavailable');
 return body.events.flatMap((e:any)=>{const c=e.competitions?.[0],home=c?.competitors?.find((x:any)=>x.homeAway==='home')?.team?.displayName,away=c?.competitors?.find((x:any)=>x.homeAway==='away')?.team?.displayName,start=Date.parse(e.date);
 if(!e.id||!home||!away||!Number.isFinite(start)||start<=now||start>now+7*86400000||c?.status?.type?.completed||c?.status?.type?.state==='in')return [];
 return [{id:`espn:${league}:${e.id}`,sport:league,startsAt:new Date(start).toISOString(),home,away,matchup:`${away} at ${home}`,markets:0,source:'ESPN schedule',scheduleOnly:true}];});
}
export async function getSchedule(origin:string,ctx:any){
 const cache=(caches as any).default,key=new Request(origin+'/_schedule-v2');const saved=await cache.match(key);if(saved)return saved.json();
 const now=Date.now(),format=(t:number)=>new Date(t).toISOString().slice(0,10).replaceAll('-',''),dates=`${format(now)}-${format(now+7*86400000)}`;
 const sources=await Promise.all(Object.entries(SCHEDULE_LEAGUES).map(async([league,path])=>{
 const days=await Promise.all([0,1,2].map(async offset=>{try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${format(now+offset*86400000)}&limit=100${league==='NCAAB'||league==='NCAAF'?'&groups=50':''}`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return {events:normalizeSchedule(await r.json(),league,now),error:null};}catch(e){return {events:[],error:e instanceof Error?e.message:'Source unavailable'};}}));
 return {league,events:[...new Map(days.flatMap(d=>d.events).map(e=>[e.id,e])).values()],error:days.some(d=>d.error)?days.map(d=>d.error).filter(Boolean).join('; '):null};}));
 const result={checkedAt:new Date(now).toISOString(),events:sources.flatMap(s=>s.events),sources:sources.map(s=>({league:s.league,count:s.events.length,error:s.error})),notice:'Today plus next two UTC days; up to 100 source events per league/day. Selected league schedules only; not complete all-sport coverage. Schedule presence does not imply available sportsbook odds.'};
 ctx.waitUntil(cache.put(key,Response.json(result,{headers:{'Cache-Control':'public,max-age=900'}})));return result;
}
