import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
import type {D1Database} from './d1-observations';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database;INTELLIGENCE_D1_WRITE_ENABLED?:string;SPORTS_D1_WRITE_ENABLED?:string;SPORTS_SCORE_COLLECT_ENABLED?:string};
const headers={'Cache-Control':'no-store'};
const intervalMinutes=(sport:string)=>sport==='nfl'||sport==='ncaaf'?15:sport.startsWith('soccer-')?20:10;
/** Read-only operational planning. NO scoreboard fetch, D1 mutation, or scheduled collection. */
export async function scorePollingPlan(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const rows=await env.INTELLIGENCE_DB.prepare("SELECT source_id,upstream_id,enabled FROM intelligence_sources WHERE source_id LIKE 'espn-scoreboard-%'").all<{source_id:string;upstream_id:string;enabled:number}>();
  const registry=new Map(rows.results.map(row=>[row.source_id,row]));
  const sources=scoreSports.map((sport,index)=>{
   const source=scoreboardSource(sport.id),row=registry.get(source.sourceId);
   const registered=row?.enabled===1&&row.upstream_id===source.upstreamId;
   return {sport:sport.id,sourceId:source.sourceId,classification:'SCORES_NOT_ODDS',registered,
    cadenceMinutes:intervalMinutes(sport.id),hourSlot:index%4,eligible:registered,
    execution:'NOT_STARTED',pagesCertified:false,continuousIngestionCertified:false};
  });
  return Response.json({ok:true,mode:'READ_ONLY_POLLING_PLAN',registered:sources.filter(s=>s.registered).length,
   planned:sources.length,flags:{collector:env.SPORTS_SCORE_COLLECT_ENABLED==='true',intelligenceWrite:env.INTELLIGENCE_D1_WRITE_ENABLED==='true',sportsWrite:env.SPORTS_D1_WRITE_ENABLED==='true'},
   sources,executionEnabled:false,executedRequests:0,performedWrites:0,
   warning:'Planning only. No cron polling, continuous freshness, event pagination, bookmaker odds, or player props are certified.'},{headers});
 }catch{return Response.json({ok:false,reason:'POLL_PLAN_READ_FAILED'},{status:503,headers});}
}
