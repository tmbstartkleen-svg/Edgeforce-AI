/** Opt-in API-Football v3 soccer research adapter (NOT sportsbook order pricing). */
export type ApiFootballTarget={leagueId:number;leagueName:string};
export type ApiFootballFixture={
 id:number;leagueId:number;league:string;startTime:string;status:string;elapsed:number|null;
 home:{id:number;name:string;score:number|null};
 away:{id:number;name:string;score:number|null};
 fetchedAt:string;source:'api-football-v3';
};
const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const int=(v:unknown):number|null=>{
 if(typeof v!=='number'&&typeof v!=='string')return null;
 if(v==='')return null;
 const n=Number(v);
 return Number.isSafeInteger(n)&&n>=0?n:null;
};
const leagues=[
 {leagueId:39,leagueName:'Premier League'},
 {leagueId:140,leagueName:'La Liga'},
 {leagueId:135,leagueName:'Serie A'},
 {leagueId:78,leagueName:'Bundesliga'},
 {leagueId:61,leagueName:'Ligue 1'},
 {leagueId:2,leagueName:'UEFA Champions League'}
];
export function apiFootballTargets(raw?:string):ApiFootballTarget[]{
 if(!raw)return leagues;
 const allowed=raw.split(',').map(v=>Number(v.trim())).filter(n=>Number.isInteger(n)&&n>0&&n<=999999);
 return [...new Set(allowed)].slice(0,8).map(leagueId=>({
  leagueId,leagueName:leagues.find(v=>v.leagueId===leagueId)?.leagueName||'League '+leagueId
 }));
}
export function footballSeason(now:Date){
 const y=now.getUTCFullYear();
 return now.getUTCMonth()>=6?y:y-1;
}
export function parseApiFootballResearch(value:unknown,target:ApiFootballTarget,receivedAt:string){
 const root=obj(value);
 const errs=root.errors;
 if(Array.isArray(errs)&&errs.length||Object.keys(obj(errs)).length)throw new Error('API-Football returned an API error');
 const pages=obj(root.paging);
 const current=int(pages.current),total=int(pages.total);
 const truncated=total!==null&&total>1;
 const games:ApiFootballFixture[]=[];
 const used=new Set<number>();
 for(const raw of arr(root.response).slice(0,200)){
  const row=obj(raw),fixture=obj(row.fixture),status=obj(fixture.status);
  const teams=obj(row.teams),home=obj(teams.home),away=obj(teams.away),goals=obj(row.goals);
  const id=int(fixture.id),h=int(home.id),a=int(away.id);
  const start=str(fixture.date),homeName=str(home.name),awayName=str(away.name);
  if(id===null||h===null||a===null||!homeName||!awayName||!Number.isFinite(Date.parse(start))||used.has(id))continue;
  used.add(id);
  const info=obj(row.league);
  games.push({
   id,leagueId:target.leagueId,league:str(info.name)||target.leagueName,
   startTime:new Date(start).toISOString(),
   status:str(status.short)||'UNKNOWN',elapsed:int(status.elapsed),
   home:{id:h,name:homeName,score:int(goals.home)},
   away:{id:a,name:awayName,score:int(goals.away)},
   fetchedAt:receivedAt,source:'api-football-v3'
  });
 }
 return {games,truncated,sourceResponseCount:int(root.results)??games.length};
}
export async function fetchApiFootballResearch(key:string,target:ApiFootballTarget,date:string,fetcher:typeof fetch=fetch){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const now=new Date();
 const url=new URL('https://v3.football.api-sports.io/fixtures');
 url.searchParams.set('date',date);url.searchParams.set('league',String(target.leagueId));
 url.searchParams.set('season',String(footballSeason(now)));url.searchParams.set('timezone','America/New_York');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  const res=await fetcher(url.toString(),{method:'GET',redirect:'error',cache:'no-store',
   signal:controller.signal,headers:{'x-apisports-key':key}});
  if(!res.ok){await res.body?.cancel();throw new Error('API-Football HTTP '+res.status)}
  if(!res.headers.get('content-type')?.includes('json'))throw new Error('API-Football response was not JSON');
  const reportedSize=Number(res.headers.get('content-length')||0);
  if(reportedSize>1400000)throw new Error('API-Football response too large');
  const reader=res.body?.getReader();
  if(!reader)throw new Error('API-Football empty response');
  const chunks:Uint8Array[]=[];let size=0;
  try{
   for(;;){
    const part=await reader.read();if(part.done)break;
    size+=part.value.length;
    if(size>1400000){await reader.cancel();throw new Error('API-Football response too large')}
    chunks.push(part.value);
   }
  }finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;
  for(const x of chunks){bytes.set(x,offset);offset+=x.length}
  const receivedAt=new Date().toISOString();
  const parsed=parseApiFootballResearch(JSON.parse(new TextDecoder().decode(bytes)),target,receivedAt);
  const remaining=int(res.headers.get('x-ratelimit-requests-remaining'));
  return {...parsed,receivedAt,remainingReported:remaining};
 }finally{clearTimeout(timer)}
}
