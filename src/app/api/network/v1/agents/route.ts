import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
export const dynamic='force-dynamic';
type Row={agentId:string;category:string;enabled:boolean;cadenceMinutes:number;
 nextDueAt:string|Date;leaseUntil:string|Date;lastStartedAt:string|Date|null;
 lastFinishedAt:string|Date|null;lastResult:string;completedRuns:number|string;
 consecutiveFailures:number;lastError:string|null;sourceRole:string|null;sourceIds:string[]|null;
 resultStatus:string|null;eventCount:number|null;payload:Record<string,unknown>|null;
 observedAt:string|Date|null};
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const sql=db();
 if(!sql)return Response.json({ok:false,status:'DATABASE_NOT_CONFIGURED',agents:[]},
  {status:503,headers:networkHeaders});
 try{
  const rows=await sql<Row[]>`
   select a.agent_id as "agentId",a.category,a.enabled,
    a.cadence_minutes as "cadenceMinutes",a.next_due_at as "nextDueAt",
    a.lease_until as "leaseUntil",a.last_started_at as "lastStartedAt",
    a.last_finished_at as "lastFinishedAt",a.last_result as "lastResult",
    a.completed_runs as "completedRuns",a.consecutive_failures as "consecutiveFailures",
    a.last_error as "lastError",obs.source_role as "sourceRole",
    obs.source_ids as "sourceIds",obs.result_status as "resultStatus",
    obs.event_count as "eventCount",obs.payload,obs.observed_at as "observedAt"
   from public.edgeforce_network_agents_v211 a
   left join lateral (
    select source_role,source_ids,result_status,event_count,payload,observed_at
    from public.edgeforce_network_agent_observations_v211
    where agent_id=a.agent_id order by observed_at desc,id desc limit 1
   ) obs on true
   order by a.category,a.agent_id limit 14`;
  const now=Date.now();
  const safeDate=(v:string|Date|null)=>v?new Date(v).toISOString():null;
  const agents=rows.map(row=>{
   const last=safeDate(row.observedAt);
   const lag=last?Math.max(0,Math.round((now-Date.parse(last))/60000)):null;
   const state=Number(new Date(row.leaseUntil).getTime())>now?'RUNNING':
    row.lastResult==='ERROR'?'FAILED':!last?'PENDING':
    lag!==null&&lag>Math.max(row.cadenceMinutes*3,180)?'STALE':'HEALTHY';
   return {
    agentId:row.agentId,category:row.category,enabled:row.enabled,
    state,nextDueAt:safeDate(row.nextDueAt),lastStartedAt:safeDate(row.lastStartedAt),
    lastFinishedAt:safeDate(row.lastFinishedAt),observedAt:last,
    lagMinutes:lag,intervalMinutes:row.cadenceMinutes,sourceRole:row.sourceRole,
    sourceIds:row.sourceIds||[],lastResult:row.lastResult,completedRuns:Number(row.completedRuns),
    consecutiveFailures:Number(row.consecutiveFailures),eventCount:row.eventCount||0,
    facts:row.payload||{},lastError:row.lastError
   };
  });
  return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v211',
   dataRole:'AUTONOMOUS_SOURCE_AWARE_RESEARCH_WORKERS',
   enabled:process.env.EDGEFORCE_AGENT_TEAM_ENABLED==='true',
   scheduledDispatchConfigured:false, // Cannot prove external GitHub Actions has the raw token or is running.
   scoreScoutEnabled:process.env.EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED==='true',
   modelsAreRawOddsSources:false,
   agents,asOf:new Date(now).toISOString(),
   summary:{agents:agents.length,healthy:agents.filter(x=>x.state==='HEALTHY').length,
    failed:agents.filter(x=>x.state==='FAILED').length,
    pending:agents.filter(x=>x.state==='PENDING').length},
   warning:'Agents operate when an authenticated dispatcher is invoked. Scheduled runs require GitHub Actions configuration and verified deployment; no hourly success is assumed. Data quality and source license checks are separate from AI conclusions.'},
   {headers:networkHeaders});
 }catch{
  return Response.json({ok:false,status:'AGENT_TABLE_UNAVAILABLE_OR_MIGRATION_MISSING',agents:[]},
   {status:503,headers:networkHeaders});
 }
}
