// Share expensive public board work across pollers. Never cache auth/client errors.
export function createBoardSnapshotCache(ttlMs=15000,staleMs=180000,maxEntries=24){
 const cache=new Map<string,{at:number;response:Response}>();
 const inFlight=new Map<string,Promise<Response>>();
 const copy=(entry:{at:number;response:Response})=>{
  const response=entry.response.clone();
  response.headers.set('x-edgeforce-snapshot-age-ms',String(Math.max(0,Date.now()-entry.at)));
  return response;
 };
 async function stale(entry:{at:number;response:Response},error:string){
  const payload=await entry.response.clone().json();
  // A retained response is a research snapshot, never a new pick or live execution quote.
  // Mark every previous row stale/blocked so unrelated consumers cannot promote old EV.
  const rows=Array.isArray(payload.rows)?payload.rows.map((row:Record<string,unknown>)=>({
   ...row,grade:'PASS',freshness:'STALE',expectedValue:0,quarterKelly:0,
   dynamicConfidence:0,intelligenceStackReady:false,reliabilityCriticalOpen:true,
   downgradeReasons:[...(Array.isArray(row.downgradeReasons)?row.downgradeReasons:[]),'Board snapshot expired; no live quote verified']
  })):[];
  return Response.json({...payload,rows,source:'stored',providerDegraded:true,
   steamCount:0,steamAlerts:[],resimulationTriggered:false,resimulatedRows:[],resimulationResults:[],
   marketCoverage:payload.marketCoverage?{...payload.marketCoverage,qualified:0}:undefined,
   topBoardQualification:payload.topBoardQualification?{...payload.topBoardQualification,qualified:0,forced:true,allowedGrades:[],fallbackMode:'STALE_SNAPSHOT',fallbackReason:'The latest refresh failed. All cached rows are blocked from recommendations.'}:undefined,
   refreshStatus:{mode:'STALE_CACHE',error,lastSuccessfulAt:new Date(entry.at).toISOString()},
   warnings:[`Board refresh failed; showing the last successful snapshot (${Math.ceil((Date.now()-entry.at)/1000)} seconds old) for research only.`,...(payload.warnings||[])]},
   {headers:{'Cache-Control':'no-store','x-edgeforce-snapshot-age-ms':String(Date.now()-entry.at)}});
 }
 return async function snapshot(key:string,load:()=>Promise<Response>){
  const previous=cache.get(key);
  if(previous&&Date.now()-previous.at<ttlMs)return copy(previous);
  let pending=inFlight.get(key);
  if(!pending){
   pending=(async()=>{
    try{
     const response=await load();
     if(response.ok){
      if(cache.size>=maxEntries&&!cache.has(key))cache.delete(cache.keys().next().value!);
      cache.set(key,{at:Date.now(),response:response.clone()});
     }else if(response.status>=500&&previous&&Date.now()-previous.at<staleMs){
      return stale(previous,`HTTP ${response.status}`);
     }
     return response;
    }catch(error){
     if(previous&&Date.now()-previous.at<staleMs)return stale(previous,error instanceof Error?error.message:'Board refresh failed');
     throw error;
    }
   })().finally(()=>inFlight.delete(key));
   inFlight.set(key,pending);
  }
  return (await pending).clone();
 };
}
