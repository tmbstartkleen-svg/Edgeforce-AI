import {evaluateSloGovernor,evaluateSloWindow,nextSloDeploymentState,type SloHealthSample} from '@/lib/sloGovernor';

export const dynamic='force-dynamic';

const now=new Date('2026-10-05T17:00:00Z');
const healthy=(count:number):SloHealthSample[]=>Array.from({length:count},(_,i)=>({
 observedAt:new Date(now.getTime()-i*5*60000).toISOString(),
 overallState:'HEALTHY',healthScore:.96,criticalChecks:0,degradedChecks:0,unknownChecks:0,actionIncidents:0,watchIncidents:0
}));

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const healthySamples=healthy(40);
 const criticalSamples=[...healthySamples.slice(0,30),...Array.from({length:10},(_,i)=>({
  observedAt:new Date(now.getTime()-i*5*60000).toISOString(),
  overallState:'CRITICAL',healthScore:.30,criticalChecks:2,degradedChecks:0,unknownChecks:0,actionIncidents:1,watchIncidents:0
 } as SloHealthSample))];
 const good=evaluateSloGovernor(healthySamples,{overall:'HEALTHY',score:.96,criticalChecks:0,actionIncidents:0},.99,now);
 const bad=evaluateSloGovernor(criticalSamples,{overall:'CRITICAL',score:.30,criticalChecks:2,actionIncidents:1},.99,now);
 const open=nextSloDeploymentState(undefined,false,true,'healthy');
 const frozen1=nextSloDeploymentState(open,true,false,'burn');
 const recovering1=nextSloDeploymentState(frozen1,false,true,'safe');
 const recovering2=nextSloDeploymentState(recovering1,false,true,'safe');
 const reopened=nextSloDeploymentState(recovering2,false,true,'safe');
 const oneHour=evaluateSloWindow(healthySamples,now,60,'1h',.99,3);
 const ok=
  !good.freezeTriggered&&good.recoveryEligible&&
  bad.freezeTriggered&&bad.windows.oneHour.burnRate>8&&
  open.state==='OPEN'&&frozen1.state==='FROZEN'&&
  recovering1.state==='RECOVERING'&&recovering2.state==='RECOVERING'&&reopened.state==='OPEN'&&
  oneHour.sufficient&&oneHour.budgetRemaining===1;
 return Response.json({ok,build:'V74',schemaVersion:'v74-slo-governor-1',good,bad,transitions:{open,frozen1,recovering1,recovering2,reopened}},{headers:{'Cache-Control':'no-store'}});
}
