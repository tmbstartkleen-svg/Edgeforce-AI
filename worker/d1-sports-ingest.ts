import {assessIngestEvidence} from './d1-ingest-quality-gate';
import {appendSportsMarketSnapshot,type D1SportsMarketQuote,type D1SportsDb} from '../src/lib/intelligence-core/d1-sports-market-store.mjs';
type Env={INGEST_SECRET?:unknown;SPORTS_D1_WRITE_ENABLED?:unknown;INTELLIGENCE_DB?:unknown};
const headers={'Cache-Control':'no-store'};
export async function d1SportsIngest(request:Request,env:Env):Promise<Response>{
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 if(typeof env.INGEST_SECRET!=='string'||!env.INGEST_SECRET||
 request.headers.get('authorization')!==`Bearer ${env.INGEST_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(env.SPORTS_D1_WRITE_ENABLED!=='true')
  return Response.json({ok:false,reason:'D1_WRITE_DISABLED'},{status:503,headers});
 const db=env.INTELLIGENCE_DB as D1SportsDb|undefined;
 if(!db||typeof db.prepare!=='function')
  return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 if(Number(request.headers.get('content-length')||0)>32768)
  return Response.json({ok:false,reason:'PAYLOAD_TOO_LARGE'},{status:413,headers});
 let quote:unknown;
 try{
  const body=await request.text();
  if(new TextEncoder().encode(body).length>32768)throw Error('PAYLOAD_TOO_LARGE');
  quote=JSON.parse(body);
  if(!quote||Array.isArray(quote)||typeof quote!=='object')throw Error('INVALID_QUOTE');
 }catch{return Response.json({ok:false,reason:'INVALID_QUOTE'},{status:400,headers});}
 try{
  const q=quote as Record<string,unknown>;
  const collectedAt=Date.now();
  const payloadBytes=new TextEncoder().encode(JSON.stringify(quote)).length;
  const quality=assessIngestEvidence({kind:'odds',observedAt:q.observedAt as number,
   collectedAt,sourceId:q.sourceId as string,upstreamId:q.upstreamId as string,
   eventId:q.sourceEventId as string,payloadBytes},collectedAt);
  if(!quality.acceptedForPilot)return Response.json({ok:false,reason:'INGEST_QUALITY_REJECTED',qualityReasons:quality.reasons},
   {status:422,headers});
  const report=await appendSportsMarketSnapshot(db,quote as D1SportsMarketQuote,{sourceApproved:true,now:collectedAt});
  return Response.json({ok:true,...report},{headers});
 }catch(e){
  const reason=e instanceof Error?e.message:'UNKNOWN';
  const blocked=reason==='SOURCE_NOT_REGISTERED_IN_D1'||reason==='SOURCE_APPROVAL_REQUIRED';
  return Response.json({ok:false,reason:blocked?reason:'INVALID_OR_FAILED_WRITE'},
   {status:blocked?403:422,headers});
 }
}
