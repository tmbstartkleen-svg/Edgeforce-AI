import {AUTOMATION_JOBS,evaluateAutomationRecords,type AutomationRunRecord} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(){
 const now=new Date('2026-10-03T12:00:00Z');
 const healthyRecords:AutomationRunRecord[]=AUTOMATION_JOBS.map(job=>({
  jobName:job.jobName,status:'success',releaseVersion:'51.0.0',
  startedAt:new Date(now.getTime()-Math.max(.25,Math.min(1,job.maxGapHours/2))*3600000).toISOString()
 }));
 const healthy=evaluateAutomationRecords(healthyRecords,now);
 const mixed=evaluateAutomationRecords([
  {jobName:'heartbeat',status:'success',startedAt:new Date(now.getTime()-3600000).toISOString()},
  {jobName:'scan',status:'success',startedAt:new Date(now.getTime()-40*3600000).toISOString()},
  {jobName:'decision',status:'failed',startedAt:new Date(now.getTime()-3600000).toISOString(),error:'test failure'},
  {jobName:'recalibrate',status:'success',startedAt:new Date(now.getTime()-2*3600000).toISOString()}
 ],now);
 const ok=
  healthy.healthy
  &&healthy.healthyCount===AUTOMATION_JOBS.length
  &&mixed.healthy===false
  &&mixed.jobs.some(x=>x.jobName==='scan'&&x.state==='STALE')
  &&mixed.jobs.some(x=>x.jobName==='decision'&&x.state==='FAILED')
  &&mixed.jobs.some(x=>x.jobName==='settle'&&x.state==='PENDING');
 return Response.json({ok,healthy,mixed});
}
