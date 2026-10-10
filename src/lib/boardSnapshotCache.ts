// Share expensive public board work across pollers. Never cache auth/client errors.
export function createBoardSnapshotCache(ttlMs=10000,staleMs=60000,maxEntries=24){
 const cache=new Map<string,{at:number;response:Response}>();
 const inFlight=new Map<string,Promise<Response>>();
 const copy=(entry:{at:number;response:Response})=>{
  const response=entry.response.clone();
  response.headers.set('x-edgeforce-snapshot-age-ms',String(Math.max(0,Date.now()-entry.at)));
  return response;
 };
 async function stale(entry:{at:number;response:Response},error:string){
  const payload=await entry.response.clone().json();
  return Response.json({...payload,source:'stored',providerDegraded:true,marketCoverage:payload.marketCoverage?{...payload.marketCoverage,qualified:0}:undefined,topBoardQualification:payload.topBoardQualification?{...payload.topBoardQualification,qualified:0,forced:true,fallbackMode:'STALE_SNAPSHOT',fallbackReason:'The latest refresh failed. Cached rows require review.'}:undefined,refreshStatus:{mode:'STALE_CACHE',error,lastSuccessfulAt:new Date(entry.at).toISOString()},warnings:[`Board refresh failed; showing the last successful snapshot (${Math.ceil((Date.now()-entry.at)/1000)} seconds old).`,...(payload.warnings||[])]},{headers:{'Cache-Control':'no-store','x-edgeforce-snapshot-age-ms':String(Date.now()-entry.at)}});
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
