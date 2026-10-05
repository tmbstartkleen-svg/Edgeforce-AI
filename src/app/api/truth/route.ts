import {gradeForecast,recordResolution,truthSummary,type ForecastGradeInput,type ForecastDomain,type ResolutionStatus} from '@/lib/eventTruth';

export const dynamic='force-dynamic';

export async function GET(){
 return Response.json({ok:true,generatedAt:new Date().toISOString(),...(await truthSummary())},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(process.env.INGEST_SECRET&&req.headers.get('authorization')!==`Bearer ${process.env.INGEST_SECRET}`){
  return Response.json({ok:false,error:'unauthorized'},{status:401});
 }
 const body=await req.json() as Record<string,unknown>;
 const eventKey=String(body.eventKey||'');
 const domain=String(body.domain||'').toUpperCase() as ForecastDomain;
 const category=String(body.category||'OTHER');
 const status=String(body.status||'RESOLVED').toUpperCase() as ResolutionStatus;
 const resolutionSource=String(body.resolutionSource||'');
 if(!eventKey||!['SPORTS','MARKETS'].includes(domain)||!resolutionSource){
  return Response.json({ok:false,error:'eventKey, domain and resolutionSource are required'},{status:400});
 }
 const outcome=typeof body.outcome==='boolean'?body.outcome:null;
 const resolution=await recordResolution({
  eventKey,domain,category,status,outcome,
  resolutionSource,
  resolutionRule:typeof body.resolutionRule==='string'?body.resolutionRule:undefined,
  resolvedAt:typeof body.resolvedAt==='string'?body.resolvedAt:undefined,
  metadata:body.metadata&&typeof body.metadata==='object'?body.metadata as Record<string,unknown>:undefined
 });
 const forecasts=Array.isArray(body.forecasts)?body.forecasts:[];
 const grades=[];
 if(outcome!==null&&status==='RESOLVED'){
  for(const value of forecasts){
   if(!value||typeof value!=='object')continue;
   const row=value as Record<string,unknown>;
   const probability=Number(row.predictedProbability);
   if(!Number.isFinite(probability))continue;
   const input:ForecastGradeInput={
    forecastId:String(row.forecastId||''),
    eventKey,
    domain,
    category,
    venue:typeof row.venue==='string'?row.venue:undefined,
    modelVersion:String(row.modelVersion||'unknown'),
    predictedProbability:probability,
    marketProbability:Number.isFinite(Number(row.marketProbability))?Number(row.marketProbability):undefined,
    outcome
   };
   if(!input.forecastId)continue;
   grades.push({forecastId:input.forecastId,...await gradeForecast(input)});
  }
 }
 return Response.json({ok:true,resolution,grades,graded:grades.length});
}
