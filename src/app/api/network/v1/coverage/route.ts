import {authorizeNetwork,networkHeaders} from '../../../../../lib/firstPartySportsNetwork';
import {normalizeProviderCatalog,type ProviderCatalog} from '../../../../../lib/coverage-provider-discovery';
import {buildSportsCoverageReport} from '../../../../../lib/sports-coverage-report';
export const runtime='nodejs';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:networkHeaders});
/** Owner-only, read-only coverage analysis of supplied licensed provider snapshots.
 * Does not ingest, persist, fetch, or pretend to enumerate live DraftKings markets.
 */
export async function POST(request:Request){
 const denied=authorizeNetwork(request);
 if(denied)return denied;
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
  return json({ok:false,error:'JSON_REQUIRED'},415);
 const raw=await request.text();
 if(raw.length>500_000)return json({ok:false,error:'PAYLOAD_TOO_LARGE'},413);
 let value:unknown;
 try{value=JSON.parse(raw);}catch{return json({ok:false,error:'INVALID_JSON'},400);}
 if(!value||typeof value!=='object'||Array.isArray(value))return json({ok:false,error:'INVALID_REQUEST'},400);
 const body=value as {catalogs?:unknown;asOf?:unknown;maxAgeMs?:unknown;bookmaker?:unknown};
 if(!Array.isArray(body.catalogs)||body.catalogs.length<1||body.catalogs.length>8||
   typeof body.asOf!=='string'||typeof body.bookmaker!=='string'||body.bookmaker!=='DraftKings'||
   !Number.isSafeInteger(body.maxAgeMs)||Number(body.maxAgeMs)<1000||Number(body.maxAgeMs)>3600000)
  return json({ok:false,error:'INVALID_REQUEST'},400);
 try{
  const batches=body.catalogs.map(c=>{
   if(!c||typeof c!=='object'||!Array.isArray((c as ProviderCatalog).events)||
      (c as ProviderCatalog).events.length>1000)throw Error('INVALID_CATALOG_LIMIT');
   return normalizeProviderCatalog(c as ProviderCatalog,'DraftKings');
  });
  return json({ok:true,mode:'SUPPLIED_SNAPSHOT_ONLY',...buildSportsCoverageReport({
   batches,asOf:body.asOf,maxAgeMs:Number(body.maxAgeMs),bookmaker:'DraftKings'
  })});
 }catch{return json({ok:false,error:'INVALID_CATALOG_OR_COVERAGE'},422);}
}
export async function GET(request:Request){
 const denied=authorizeNetwork(request);
 if(denied)return denied;
 return json({ok:true,mode:'SUPPLIED_SNAPSHOT_ONLY',liveConnected:false,
  message:'POST authorized provider snapshots to evaluate coverage. No live DraftKings enumeration is connected.'});
}
