import {db} from '../db';
import {planAgentRuns,AGENTS} from './agent-planner.mjs';

/** Durable, opt-in orchestration. Never schedules unsupported adapter identities. */
const SUPPORTED=['injuries-lineups','sportsbook-odds'];
const byId=new Map(AGENTS.map(agent=>[agent.id,agent]));
const interval=(agent:typeof AGENTS[number])=>Math.max(agent.activeMs,60000);
const keyFor=(agent:typeof AGENTS[number],at:number)=>'core:'+agent.id+':'+Math.floor(at/interval(agent));

export async function enqueueIntelligenceAgents(now=Date.now()){
 const sql=db();
 if(!sql)return {ok:false,reason:'DATABASE_UNAVAILABLE',enqueued:0};
 const last=await sql`
  select agent_id,max(scheduled_at) as last_at from intelligence_agent_runs
  where agent_id in ('injuries-lineups','sportsbook-odds')
  group by agent_id
 `;
 const lastRuns=Object.fromEntries(last.map(row=>[row.agent_id,new Date(row.last_at).getTime()]));
 const p=planAgentRuns({now,activeEvent:true,lastRuns,supported:SUPPORTED,availableBudget:2,maxTasks:1});
 let enqueued=0;
 for(const task of p.tasks){
  const spec=byId.get(task.agentId);
  if(!spec)continue;
  const runKey=keyFor(spec,now);
  const inserted=await sql`
   insert into intelligence_agent_runs(agent_id,run_key,status,scheduled_at,budget_units)
   values(${task.agentId},${runKey},'PLANNED',to_timestamp(${now}/1000.0),${task.budgetUnits})
   on conflict (run_key) do nothing returning run_id
  `;
  enqueued+=inserted.length;
 }
 return {ok:true,enqueued,skipped:p.skipped};
}

/** Atomic leasing prevents concurrent invocations claiming the same job. */
export async function leaseIntelligenceAgent(now=Date.now()){
 const sql=db();
 if(!sql)return null;
 const rows=await sql`
  with candidate as (
   select run_id from intelligence_agent_runs
   where (status='PLANNED' or (status='RUNNING' and lease_until < to_timestamp(${now}/1000.0)))
     and attempt_count < 3 and agent_id in ('injuries-lineups','sportsbook-odds')
   order by scheduled_at asc,run_id asc limit 1 for update skip locked
  )
  update intelligence_agent_runs a
  set status='RUNNING',started_at=to_timestamp(${now}/1000.0),
      attempt_count=a.attempt_count+1,
      lease_until=to_timestamp(${now}/1000.0)+interval '2 minutes'
  from candidate where a.run_id=candidate.run_id
  returning a.run_id,a.agent_id,a.attempt_count
 `;
 return rows[0]??null;
}

/** Explicitly whitelist existing first-party collection paths. */
export async function executeIntelligenceAgent(agentId:string,secret:string){
 if(!secret)throw new Error('CRON_SECRET_REQUIRED');
 const req=new Request('https://edgeforce.internal/api/cron/'+(agentId==='injuries-lineups'?'injuries':'scan'),{
  headers:{authorization:'Bearer '+secret}
 });
 let response;
 if(agentId==='injuries-lineups'){
  const {GET}=await import('../../app/api/cron/injuries/route');
  response=await GET(req);
 }else if(agentId==='sportsbook-odds'){
  const {GET}=await import('../../app/api/cron/scan/route');
  response=await GET(req);
 }else throw new Error('UNSUPPORTED_AGENT');
 if(!response.ok)throw new Error('COLLECTOR_HTTP_'+response.status);
 return {status:response.status};
}

export async function completeIntelligenceAgent(runId:number,ok:boolean,error=''){
 const sql=db();
 if(!sql)throw new Error('DATABASE_UNAVAILABLE');
 const status=ok?'SUCCEEDED':'FAILED';
 await sql`
  update intelligence_agent_runs set status=${status},finished_at=now(),
      lease_until=null,error_summary=${String(error).slice(0,350)}
  where run_id=${runId} and status='RUNNING'
 `;
}

export async function runIntelligenceCoreOnce({now=Date.now(),secret=''}:{now?:number;secret?:string}={}){
 if(process.env.INTELLIGENCE_CORE_ENABLED!=='true')return {ok:false,reason:'DISABLED'};
 const queued=await enqueueIntelligenceAgents(now);
 if(!queued.ok)return queued;
 const job=await leaseIntelligenceAgent(now);
 if(!job)return {ok:true,queued,executed:0};
 try{
  await executeIntelligenceAgent(job.agent_id,secret);
  await completeIntelligenceAgent(job.run_id,true);
  return {ok:true,queued,executed:1,agentId:job.agent_id};
 }catch(error){
  const message=error instanceof Error?error.message:'COLLECTOR_FAILED';
  await completeIntelligenceAgent(job.run_id,false,message);
  return {ok:false,queued,executed:1,agentId:job.agent_id,error:message};
 }
}
