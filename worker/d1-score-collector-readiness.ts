import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
import type {D1Database} from './d1-observations';
type Env={CRON_SECRET?:string;SPORTS_SCORE_COLLECT_ENABLED?:string;INTELLIGENCE_D1_WRITE_ENABLED?:string;INTELLIGENCE_DB?:D1Database};
const h={'Cache-Control':'no-store'};
/** Authenticated read-only evidence. A registered scoreboard is NOT proof of live scores or sportsbook odds. */
export async function scoreCollectorReadiness(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...h,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:h});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers:h});
 try{
  const observed=await env.INTELLIGENCE_DB.prepare(
   "SELECT source_id,upstream_id,enabled FROM intelligence_sources WHERE source_id LIKE 'espn-scoreboard-%'"
  ).all<{source_id:string;upstream_id:string;enabled:number}>();
  const registry=new Map(observed.results.map(x=>[x.source_id,x]));
  const sources=scoreSports.map(s=>{
   const source=scoreboardSource(s.id),row=registry.get(source.sourceId);
   const approved=!!row&&row.enabled===1&&row.upstream_id===source.upstreamId;
   return {sport:s.id,sourceId:source.sourceId,classification:source.classification,approved,reason:!row?'NOT_REGISTERED':row.enabled!==1?'SOURCE_DISABLED':row.upstream_id!==source.upstreamId?'UPSTREAM_MISMATCH':null};
  });
  return Response.json({ok:true,mode:'READ_ONLY_SOURCE_REGISTRATION_AUDIT',expected:sources.length,approved:sources.filter(x=>x.approved).length,missing:sources.filter(x=>!x.approved).map(x=>({sport:x.sport,reason:x.reason})),
   flags:{collectionEnabled:env.SPORTS_SCORE_COLLECT_ENABLED==='true',d1WriteEnabled:env.INTELLIGENCE_D1_WRITE_ENABLED==='true'},
   sources,warning:'Registration is not live ingestion. ESPN scoreboards are never DraftKings odds. No collection or write was performed.'},{headers:h});
 }catch{return Response.json({ok:false,reason:'REGISTRATION_READ_FAILED'},{status:503,headers:h});}
}
