import {ingestOdds} from '@/lib/providers/ingest';
import {scanEdgeOpportunities} from '@/lib/edgeScanner';

export const dynamic='force-dynamic';

async function withTimeout<T>(promise:Promise<T>,ms:number,label:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   promise,
   new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms)})
  ]);
 }finally{
  if(timer)clearTimeout(timer);
 }
}

export async function GET(){
 try{
  const ingestion=await withTimeout(
   ingestOdds(),
   Math.max(5000,Number(process.env.EDGE_SCANNER_INGEST_TIMEOUT_MS||14000)),
   'edge scanner ingestion'
  );

  const verifiedSource=ingestion.source==='live'&&ingestion.mode==='live'&&!ingestion.degraded&&Boolean(ingestion.panelMarkets?.length);
  // Stored and demo odds do not establish a live execution price. Fail closed.
  const result=scanEdgeOpportunities(verifiedSource?(ingestion.panelMarkets||[]):[],{
   kellyFraction:Number(process.env.EDGE_SCANNER_KELLY_FRACTION||.25),
   minEv:Number(process.env.EDGE_SCANNER_MIN_EV||.01),
   maxArbitrage:25,
   maxPositiveEv:50
  });

  return Response.json({
   ok:verifiedSource,
   scanStatus:verifiedSource?'VERIFIED':'SOURCE_UNVERIFIED',
   scanReason:verifiedSource?'Current timestamped provider quotes checked for independent reference prices':'Live independent bookmaker panel unavailable; no actionable cross-book price signal',
   source:ingestion.source,
   providerMode:ingestion.mode,
   providerName:ingestion.providerName,
   providerDegraded:ingestion.degraded,
   providerAttempts:ingestion.attempts,
   targetBook:ingestion.targetBook,
   result
  },{
   headers:{'Cache-Control':'no-store, max-age=0'}
  });
 }catch(error){
  return Response.json({
   ok:false,
   error:'EDGE_SCANNER_RUNTIME_ERROR',
   message:error instanceof Error?error.message:'edge scanner failed',
   generatedAt:new Date().toISOString()
  },{
   status:503,
   headers:{'Cache-Control':'no-store, max-age=0'}
  });
 }
}
