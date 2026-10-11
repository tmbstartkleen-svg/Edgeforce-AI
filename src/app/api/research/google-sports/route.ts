import {configuredSerpSportsTargets,requestSerpGoogleSports} from '@/lib/providers/serpGoogleSports';
import {acquireSerpSportsLease,finishSerpSportsLease,SERP_GOOGLE_MAX_MONTHLY} from '@/lib/providers/sharedSerpSportsBudget';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};

/** User-requested supplemental research only. Not an odds, live-score or execution feed. */
export async function GET(){
 const targets=configuredSerpSportsTargets();
 const enabled=process.env.SERPAPI_SPORTS_ENABLED==='true';
 const key=process.env.SERPAPI_API_KEY?.trim()||'';
 const base={source:'serpapi-google-sports',dataRole:'SCHEDULE_RESEARCH_ONLY',
  oddsProvider:false,liveScoreSource:false,enabled,configured:Boolean(key),monthlyAttemptCap:SERP_GOOGLE_MAX_MONTHLY,
  targets:targets.map(x=>({id:x.id,name:x.name,sp:x.sp}))};
 if(!enabled||!key||!targets.length)return Response.json({...base,ok:false,
  status:!enabled?'DISABLED':!key?'KEY_MISSING':'TARGETS_MISSING',
  games:[],warning:'Google Sports research requires opt-in, a vendor key and verified league IDs.'},{headers});
 try{
  const lease=await acquireSerpSportsLease(key,targets);
  if(lease.kind==='cached')return Response.json({...base,ok:true,status:'CACHED_RESEARCH',
   target:lease.value.target.name,games:lease.value.games,
   sourceObservedAt:lease.value.observedAt,lastFetchedAt:lease.value.fetchedAt,
   remainingAttemptBudget:lease.remaining,
   warning:'Historical/cached research, not a live trading price or independent sportsbook feed.'},{headers});
  if(lease.kind==='hold')return Response.json({...base,ok:false,status:lease.reason,
   games:[],remainingAttemptBudget:lease.remaining,retryAfterSeconds:Math.ceil(lease.retryAfterMs/1000),
   warning:'The shared SerpApi budget is on cooldown; no extra upstream request made.'},{headers});
  try{
   const result=await requestSerpGoogleSports(key,lease.target);
   const fetchedAt=new Date().toISOString();
   const value={schema:1 as const,target:lease.target,games:result.games,
    observedAt:result.observedAt||fetchedAt,fetchedAt};
   await finishSerpSportsLease(lease,value);
   return Response.json({...base,ok:true,status:'RESEARCH_FRESHLY_FETCHED',
    target:lease.target.name,games:value.games,sourceObservedAt:value.observedAt,
    lastFetchedAt:fetchedAt,remainingAttemptBudget:lease.remaining,
    warning:'Google Sports results are supplemental research; sportsbook quote verification remains independent.'},{headers});
  }catch(error){
   try{await finishSerpSportsLease(lease,null)}catch{/* Preserve original safe failure */}
   return Response.json({...base,ok:false,status:'UPSTREAM_FAILED',games:[],
    remainingAttemptBudget:lease.remaining,
    warning:'SerpApi fetch failed; next shared quota window remains reserved to prevent retries.',
    errorType:error instanceof Error?error.name:'ProviderError'},{headers,status:503});
  }
 }catch(error){
  return Response.json({...base,ok:false,status:'SHARED_BUDGET_UNAVAILABLE',games:[],
   warning:'Shared PostgreSQL quota protection is unavailable. Upstream fetch was not attempted.',
   errorType:error instanceof Error?error.name:'StorageError'},{headers,status:503});
 }
}
