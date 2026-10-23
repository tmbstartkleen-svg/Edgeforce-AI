import type {D1Database} from './d1-observations';
import {scoreSports,scoreboardSource} from '../src/lib/intelligence-core/score-source-catalog.mjs';
type Env={CRON_SECRET?:string;INTELLIGENCE_DB?:D1Database;SCHEDULED_SCORE_COLLECTION_ENABLED?:string;SPORTS_SCORE_COLLECT_ENABLED?:string;INTELLIGENCE_D1_WRITE_ENABLED?:string;SPORTS_D1_WRITE_ENABLED?:string};
const headers={'Cache-Control':'no-store'};
/** Read-only operational freshness audit from scheduler receipts; no collection or writes. */
export async function scoreSchedulerHealth(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 if(!env.INTELLIGENCE_DB?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const rows=await env.INTELLIGENCE_DB.prepare(`SELECT sport,source_id,scheduled_at,completed_at,attempt_count,final_status,persisted,outcome
   FROM score_scheduler_receipts WHERE (sport,scheduled_at) IN
    (SELECT sport,MAX(scheduled_at) FROM score_scheduler_receipts GROUP BY sport)`).all<{
     sport:string;source_id:string;scheduled_at:string;completed_at:string|null;attempt_count:number;final_status:number|null;persisted:number;outcome:string
   }>();
  const latest=new Map(rows.results.map(row=>[row.sport,row]));
  const now=Date.now();
  const sources=scoreSports.map(sport=>{
   const source=scoreboardSource(sport.id),row=latest.get(sport.id);
   const ageMinutes=row?Math.max(0,Math.floor((now-Date.parse(row.scheduled_at))/60000)):null;
   return {sport:sport.id,sourceId:source.sourceId,hasReceipt:!!row,lastScheduledAt:row?.scheduled_at||null,
    ageMinutes,lastOutcome:row?.outcome||'NO_RECEIPT',attempts:row?.attempt_count??0,lastStatus:row?.final_status??null,
    persisted:row?.persisted===1,stale:ageMinutes===null||ageMinutes>10};
  });
  return Response.json({ok:true,mode:'READ_ONLY_SCHEDULER_HEALTH',sourceCount:sources.length,
   sourcesWithReceipts:sources.filter(s=>s.hasReceipt).length,staleSources:sources.filter(s=>s.stale).length,
   flags:{scheduler:env.SCHEDULED_SCORE_COLLECTION_ENABLED==='true',collector:env.SPORTS_SCORE_COLLECT_ENABLED==='true',
    intelligenceWrite:env.INTELLIGENCE_D1_WRITE_ENABLED==='true',sportsWrite:env.SPORTS_D1_WRITE_ENABLED==='true'},
   sources,collectionTriggered:false,writesPerformed:0,
   warning:'Receipt-based scheduler freshness only. No receipt means no execution evidence; it does not prove an upstream source is unavailable.'},{headers});
 }catch{return Response.json({ok:false,reason:'SCHEDULER_HEALTH_READ_FAILED_OR_RECEIPTS_MISSING'},{status:503,headers});}
}
