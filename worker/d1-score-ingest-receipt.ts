import type {D1Database} from './d1-observations';
import {scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database};
const headers={'Cache-Control':'no-store'};
/** Read-only, bounded, source-specific D1 receipt; excludes record payloads. */
export async function scoreIngestReceipt(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 const query=new URL(request.url).searchParams;
 let source:ReturnType<typeof scoreboardSource>;
 try{source=scoreboardSource(query.get('sport')||'');}
 catch{return Response.json({ok:false,reason:'SPORT_NOT_APPROVED'},{status:400,headers});}
 const since=query.get('since')||'';
 const sinceMs=Date.parse(since),now=Date.now();
 if(!Number.isFinite(sinceMs)||sinceMs>now||now-sinceMs>15*60*1000)
  return Response.json({ok:false,reason:'INVALID_CERTIFICATION_WINDOW'},{status:400,headers});
 try{
  const rows=await env.INTELLIGENCE_DB.prepare(
   `SELECT event_id, observed_at, ingested_at, payload_hash FROM intelligence_observations
     WHERE observation_kind='score' AND source_id=? AND upstream_id=? AND observed_at>=?
     ORDER BY observed_at DESC LIMIT 25`
  ).bind(source.sourceId,source.upstreamId,new Date(sinceMs).toISOString())
   .all<{event_id:string;observed_at:string;ingested_at:string;payload_hash:string}>();
  return Response.json({ok:true,mode:'SOURCE_SCOPED_D1_SCORE_RECEIPT',classification:'SCORES_NOT_ODDS',
   sport:source.sport,sourceId:source.sourceId,upstreamId:source.upstreamId,since:new Date(sinceMs).toISOString(),
   count:rows.results.length,records:rows.results,persisted:rows.results.length>0,
   warning:'Receipt verifies D1 records for a source and time window, not that a sportsbook quote is available.'},{headers});
 }catch{return Response.json({ok:false,reason:'SCORE_RECEIPT_READ_FAILED'},{status:503,headers});}
}
