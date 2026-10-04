import {db} from './db';
import {RELEASE} from './releaseManifest';

export type AutomationJobName='heartbeat'|'settle'|'scan'|'decision'|'recalibrate'|'prediction-intelligence';
export type AutomationRunStatus='success'|'failed';
export type AutomationHealthState='HEALTHY'|'STALE'|'FAILED'|'PENDING';

export type AutomationRunRecord={
 jobName:AutomationJobName;
 status:AutomationRunStatus;
 releaseVersion?:string;
 startedAt:string|Date;
 completedAt?:string|Date;
 durationMs?:number;
 error?:string|null;
 metadata?:Record<string,unknown>;
};

export const AUTOMATION_JOBS:Array<{jobName:AutomationJobName;maxGapHours:number;description:string}>=[
 {jobName:'heartbeat',maxGapHours:30,description:'readiness heartbeat'},
 {jobName:'settle',maxGapHours:30,description:'automatic wager/result settlement'},
 {jobName:'scan',maxGapHours:30,description:'odds scan and model-run persistence'},
 {jobName:'decision',maxGapHours:30,description:'decision journal and alerts'},
 {jobName:'recalibrate',maxGapHours:30,description:'model and SGP recalibration'},
 {jobName:'prediction-intelligence',maxGapHours:3,description:'Kalshi/Polymarket market, trade and trader intelligence collection'}
];

export function evaluateAutomationRecords(records:AutomationRunRecord[],now=new Date()){
 const latest=new Map<AutomationJobName,AutomationRunRecord>();
 for(const row of records){
  const current=latest.get(row.jobName);
  if(!current||new Date(row.startedAt).getTime()>new Date(current.startedAt).getTime())latest.set(row.jobName,row);
 }
 const jobs=AUTOMATION_JOBS.map(job=>{
  const row=latest.get(job.jobName);
  if(!row)return {...job,state:'PENDING' as const,lastRun:null,ageHours:null,status:null,releaseVersion:null,error:null};
  const ageHours=Math.max(0,(now.getTime()-new Date(row.startedAt).getTime())/3600000);
  const state:AutomationHealthState=row.status==='failed'?'FAILED':ageHours>job.maxGapHours?'STALE':'HEALTHY';
  return {
   ...job,state,lastRun:new Date(row.startedAt).toISOString(),ageHours,
   status:row.status,releaseVersion:row.releaseVersion||null,error:row.error||null
  };
 });
 const blockers=jobs.filter(x=>x.state==='FAILED'||x.state==='STALE').map(x=>`${x.jobName}: ${x.state.toLowerCase()}`);
 const warnings=jobs.filter(x=>x.state==='PENDING').map(x=>`${x.jobName}: no durable run recorded yet`);
 return {
  healthy:blockers.length===0,
  jobs,
  blockers,
  warnings,
  healthyCount:jobs.filter(x=>x.state==='HEALTHY').length,
  pendingCount:jobs.filter(x=>x.state==='PENDING').length,
  failedCount:jobs.filter(x=>x.state==='FAILED').length,
  staleCount:jobs.filter(x=>x.state==='STALE').length
 };
}

export async function recordAutomationRun(
 jobName:AutomationJobName,
 status:AutomationRunStatus,
 startedAt:number,
 metadata:Record<string,unknown>={},
 errorText?:string
){
 const sql=db();
 if(!sql)return {recorded:false,mode:'memory' as const};
 const completedAt=Date.now();
 await sql`
  insert into automation_runs(job_name,status,release_version,started_at,completed_at,duration_ms,metadata,error_text)
  values(
   ${jobName},${status},${RELEASE.appVersion},${new Date(startedAt).toISOString()},
   ${new Date(completedAt).toISOString()},${Math.max(0,completedAt-startedAt)},
   ${sql.json(metadata as any)},${errorText??null}
  )
 `.catch(()=>undefined);
 return {recorded:true,mode:'database' as const};
}

export async function getAutomationHealth(){
 const sql=db();
 if(!sql)return {source:'memory' as const,...evaluateAutomationRecords([])};
 try{
  const rows=await sql`
   select distinct on (job_name)
    job_name as "jobName",status,release_version as "releaseVersion",
    started_at as "startedAt",completed_at as "completedAt",duration_ms as "durationMs",
    metadata,error_text as error
   from automation_runs
   order by job_name,started_at desc
  `;
  return {source:'database' as const,...evaluateAutomationRecords(rows as unknown as AutomationRunRecord[])};
 }catch(error){
  return {
   source:'database' as const,
   ...evaluateAutomationRecords([]),
   queryError:error instanceof Error?error.message:'automation health query failed'
  };
 }
}
