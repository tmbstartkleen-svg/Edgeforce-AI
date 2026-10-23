#!/usr/bin/env node
// Read-only isolated scheduler readiness certification. Requires pilot secret in env.
// Never enables collection, invokes cron, or writes D1.
const base=process.env.EDGEFORCE_PILOT_URL||'https://edgeforce-d1-pilot.tmbstartkleen.workers.dev';
const secret=process.env.EDGEFORCE_PILOT_CRON_SECRET||'';
if(secret.length<24)throw Error('PILOT_SECRET_REQUIRED');
if(!/^https:\/\/edgeforce-d1-pilot\.tmbstartkleen\.workers\.dev$/.test(base))throw Error('ISOLATED_PILOT_ONLY');
const request=async path=>{
 const response=await fetch(base+path,{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000)});
 const body=await response.json().catch(()=>null);
 if(response.status!==200||body?.ok!==true)throw Error('READ_ONLY_ENDPOINT_FAILED_'+path+'_'+response.status+'_'+String(body?.reason||'UNKNOWN'));
 return body;
};
const readiness=await request('/api/operations/d1-pilot/score-collector-readiness');
if(readiness.approved!==16||readiness.expected!==16||readiness.flags?.collectionEnabled!==false||readiness.flags?.d1WriteEnabled!==false)
 throw Error('SOURCE_REGISTRATION_OR_DISABLED_FLAGS_UNVERIFIED');
const plan=await request('/api/operations/d1-pilot/score-polling-plan');
if(plan.registered!==16||plan.planned!==16||plan.dispatchCadenceMinutes!==5||plan.cohortCount!==2||plan.estimatedPerSourceCadenceMinutes!==10||
 plan.flags?.collector!==false||plan.flags?.intelligenceWrite!==false||plan.flags?.sportsWrite!==false||plan.executionEnabled!==false||
 plan.executedRequests!==0||plan.performedWrites!==0)throw Error('POLL_PLAN_NOT_SAFE_OR_MISMATCHED');
const receipts=await request('/api/operations/d1-pilot/score-scheduler-receipts?limit=40');
if(receipts.mode!=='READ_ONLY_SCHEDULER_RECEIPTS'||!Array.isArray(receipts.receipts)||receipts.collectionTriggered!==false||receipts.writesPerformedByEndpoint!==0)
 throw Error('SCHEDULER_RECEIPTS_UNVERIFIED');
const health=await request('/api/operations/d1-pilot/score-scheduler-health');
if(health.mode!=='READ_ONLY_SCHEDULER_HEALTH'||health.sourceCount!==16||health.monitoringActive!==false||health.missedRunAlerts!==0||
 health.flags?.scheduler!==false||health.flags?.collector!==false||health.flags?.intelligenceWrite!==false||
 health.collectionTriggered!==false||health.writesPerformed!==0)
 throw Error('SCHEDULER_HEALTH_OR_DISABLED_MODE_UNVERIFIED');
const ending=await request('/api/operations/d1-pilot/score-collector-readiness');
if(ending.flags?.collectionEnabled!==false||ending.flags?.d1WriteEnabled!==false)throw Error('FLAGS_CHANGED_DURING_READ_ONLY_CERT');
console.log(JSON.stringify({ok:true,mode:'READ_ONLY_SCHEDULER_PREFLIGHT',registered:plan.registered,dispatchMinutes:plan.dispatchCadenceMinutes,
 cohortCount:plan.cohortCount,estimatedPerSourceMinutes:plan.estimatedPerSourceCadenceMinutes,receiptRows:receipts.count,healthSources:health.sourceCount,missedRunAlerts:health.missedRunAlerts,
 collectionEnabled:false,d1WriteEnabled:false,collectionTriggered:false,writesPerformed:0,
 nextStep:'CONTROLLED_ISOLATED_SCHEDULED_EXECUTION_NOT_YET_CERTIFIED'}));
