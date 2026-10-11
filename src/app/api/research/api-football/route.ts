import {apiFootballTargets,fetchApiFootballResearch} from '@/lib/providers/apiFootballResearch';
import {acquireApiFootballLease,finishApiFootballLease,API_FOOTBALL_MAX_DAILY} from '@/lib/providers/sharedApiFootballBudget';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
/** Opt-in soccer fixture supplement, NOT a second sportsbook odds provider. */
export async function GET(){
 const enabled=process.env.API_FOOTBALL_RESEARCH_ENABLED==='true';
 const key=process.env.API_SPORTS_KEY?.trim()||process.env.API_FOOTBALL_KEY?.trim()||'';
 const targets=apiFootballTargets(process.env.API_FOOTBALL_RESEARCH_LEAGUES);
 const base={
  source:'api-football-v3',dataRole:'SOCCER_FIXTURE_RESEARCH',
  oddsProvider:false,enabled,configured:Boolean(key),
  dailyFreeBudgetCap:API_FOOTBALL_MAX_DAILY,
  leagues:targets.map(t=>({id:t.leagueId,name:t.leagueName}))
 };
 if(!enabled||!key||!targets.length)return Response.json({...base,ok:false,
  status:!enabled?'DISABLED':!key?'KEY_MISSING':'LEAGUES_MISSING',fixtures:[],
  warning:'API-Football free research requires opt-in and a vendor-issued secret.'},{headers});
 try{
  const lease=await acquireApiFootballLease(key,targets);
  if(lease.kind==='cached')return Response.json({...base,ok:true,status:'CACHED_RESEARCH',
   league:lease.snapshot.target.leagueName,fixtures:lease.snapshot.games,
   lastFetchedAt:lease.snapshot.fetchedAt,
   sourceResponseCount:lease.snapshot.sourceResponseCount,truncated:lease.snapshot.truncated,
   providerRemaining:lease.snapshot.remainingReported,remainingLocalBudget:lease.remaining,
   warning:'Cached soccer research, not a live price or an independent sportsbook feed.'},{headers});
  if(lease.kind==='hold')return Response.json({...base,ok:false,
   status:lease.reason,fixtures:[],remainingLocalBudget:lease.remaining,
   retryAfterSeconds:Math.ceil(lease.retryAfterMs/1000),
   warning:'Shared API-Football request allowance is cooling down; no upstream request sent.'},{headers});
  try{
   const date=new Date().toISOString().slice(0,10);
   const data=await fetchApiFootballResearch(key,lease.target,date);
   const snap={schema:1 as const,target:lease.target,date, games:data.games,
    fetchedAt:data.receivedAt,truncated:data.truncated,
    sourceResponseCount:data.sourceResponseCount,remainingReported:data.remainingReported};
   await finishApiFootballLease(lease,snap);
   return Response.json({...base,ok:true,status:'NEW_RESEARCH',
    league:lease.target.leagueName,fixtures:snap.games,lastFetchedAt:data.receivedAt,
    sourceResponseCount:data.sourceResponseCount,truncated:data.truncated,
    providerRemaining:data.remainingReported,remainingLocalBudget:lease.remaining,
    warning:'Soccer fixture research only; not a sportsbook quote or an automatic trade.'},{headers});
  }catch(error){
   try{await finishApiFootballLease(lease,null)}catch{/* Keep original failure type */}
   return Response.json({...base,ok:false,status:'UPSTREAM_UNAVAILABLE',
    fixtures:[],remainingLocalBudget:lease.remaining,
    errorType:error instanceof Error?error.name:'ProviderError',
    warning:'Vendor request failed. The free daily budget slot stays spent to prevent retries.'},
    {status:503,headers});
  }
 }catch(error){
  return Response.json({...base,ok:false,status:'QUOTA_DATABASE_UNAVAILABLE',
   fixtures:[],errorType:error instanceof Error?error.name:'DatabaseError',
   warning:'Postgres shared request budget unavailable. No API-Football request attempted.'},
   {status:503,headers});
 }
}
