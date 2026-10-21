import {reconcileCoverage,type CoverageObservation} from '../src/lib/coverage-inventory';
import type {D1Database} from './d1-observations';
type Row={source_id:string;event_id:string;observed_at:string;payload:string};
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:noStore});
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0?v.trim():'';
/** Read real persisted D1 odds observations; no network fetch or unapproved provider quote inference. */
export async function d1CoverageGateway(request:Request,env:{CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown}):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||
    request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)
  return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return json({ok:false,error:'D1_BINDING_MISSING'},503);
 const u=new URL(request.url),limit=Number(u.searchParams.get('limit')||100);
 if(!Number.isSafeInteger(limit)||limit<1||limit>250)return json({ok:false,error:'INVALID_LIMIT'},400);
 try{
  const records=await db.prepare(`SELECT source_id,event_id,observed_at,payload FROM intelligence_observations
    WHERE observation_kind='odds' ORDER BY observed_at DESC LIMIT ?`).bind(limit).all<Row>();
  const now=Date.now(),observations:CoverageObservation[]=[];let unrecognized=0;
  for(const record of records.results){
   let p:Record<string,unknown>;
   try{p=JSON.parse(record.payload);}catch{unrecognized++;continue;}
   if(!p||typeof p!=='object'||Array.isArray(p)){unrecognized++;continue;}
   // D1 persists the normalized observation envelope; quote fields belong to value.
   const q=(p.value&&typeof p.value==='object'&&!Array.isArray(p.value)?p.value:p) as Record<string,unknown>;
   const bookmaker=str(q.bookmaker),sport=str(q.sport),league=str(q.league);
   const marketType=str(q.marketType),outcomeId=str(q.outcomeId),startsAt=str(q.startsAt);
   if(!bookmaker||!sport||!league||!marketType||!outcomeId||!startsAt){unrecognized++;continue;}
   const price=q.priceAmerican;
   if(price!==undefined&&(!Number.isInteger(price)||Math.abs(price as number)<100)){unrecognized++;continue;}
   observations.push({provider:record.source_id,bookmaker,sport,league,eventId:record.event_id,
    marketType,outcomeId,observedAt:record.observed_at,startsAt,
    ...(price!==undefined?{priceAmerican:price as number}:{}),
    ...(str(q.playerId)?{playerId:str(p.playerId)}:{}),
    ...(str(q.line)?{line:str(p.line)}:{})});
  }
  const report=reconcileCoverage({observations,expected:[],now:new Date(now).toISOString(),
   maxAgeMs:15*60*1000,targetBookmaker:'DraftKings'});
  return json({ok:true,mode:'PERSISTED_D1_ODDS',liveProviderConnected:false,
   discovered:{...report.observed},freshDraftKingsQuotes:report.observations.filter(x=>x.priceAmerican!==undefined).length,
   missingMarketCount:null,missingReason:'NO_INDEPENDENT_EXPECTED_CATALOG',
   rowsInspected:records.results.length,unrecognizedRows:unrecognized,rejected:report.rejected,
   asOf:report.asOf,warning:'D1 is a persisted observation source, not proof of complete DraftKings availability.'});
 }catch{return json({ok:false,error:'COVERAGE_READ_FAILED'},503);}
}
