import {SPECIALIST_AGENTS,routeSpecialistTask} from './specialist-network.mjs';

/** Planner only: assigns jobs under strict budgets; never scans or writes data. */
export function planSpecialistAssignments({
 jobs=[],approvedSources=[],maxAssignments=6,maxCost=12,
 disabledAgents=[],now=Date.now()
}={}){
 if(!Array.isArray(jobs)||!Array.isArray(approvedSources)||
  !Number.isInteger(maxAssignments)||maxAssignments<0||maxAssignments>20||
  !Number.isInteger(maxCost)||maxCost<0||maxCost>100)
  throw new TypeError('INVALID_SPECIALIST_PLAN');
 const enabled=new Set(approvedSources.filter(x=>x?.enabled===true && x?.licenseApproved===true)
  .map(x=>String(x.sourceId)));
 const denied=new Set(disabledAgents);
 const assignments=[],rejected=[];let spent=0;
 for(const job of jobs.slice(0,100)){
  const agent=routeSpecialistTask({division:job?.division,sport:job?.sport,category:job?.category});
  const cost=Number(job?.cost??1);
  const sourceId=String(job?.sourceId??'');
  if(!agent||denied.has(agent.id)||!enabled.has(sourceId)||
    !Number.isInteger(cost)||cost<1||cost>10||
    assignments.length>=maxAssignments||spent+cost>maxCost){
   rejected.push({jobId:String(job?.id??'unknown'),reason:'UNAPPROVED_OR_BUDGET_EXCEEDED'});
   continue;
  }
  assignments.push({jobId:String(job.id),agentId:agent.id,division:agent.division,
   sourceId,cost,plannedAt:new Date(now).toISOString(),execution:'PROPOSED_ONLY'});
  spent+=cost;
 }
 return {mode:'PLAN_ONLY',assignments,rejected,spent,budgetRemaining:maxCost-spent,
  dataPreservation:'NO_DELETES_NO_MIGRATIONS',totalRegisteredAgents:SPECIALIST_AGENTS.length};
}
