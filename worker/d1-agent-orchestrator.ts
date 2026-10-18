// Deterministic, side-effect-free orchestrator plan for D1 specialist agents.
// Never schedules jobs or mutates data without separate explicit activation.
export type SourceHealth={sourceId:string;enabled:boolean;ageMinutes:number|null;status:string};
export function planAgentActions(input:SourceHealth[],opts:{maxTasks?:number;now?:number}={}){
 if(!Array.isArray(input)||input.length>1000)throw Error('INVALID_AGENT_INPUT');
 const limit=Math.min(25,Math.max(0,Math.floor(opts.maxTasks??10)));
 const observed=new Set<string>();const actions: {sourceId:string;action:string;reason:string;priority:number}[]=[];
 for(const source of input){
  if(!source||typeof source.sourceId!=='string'||!/^[a-zA-Z0-9._:-]{1,128}$/.test(source.sourceId)||observed.has(source.sourceId))continue;
  observed.add(source.sourceId);
  if(!source.enabled)continue;
  const stale=source.status==='STALE'||source.status==='NO_OBSERVATIONS'||source.status==='FUTURE_TIMESTAMP';
  if(!stale)continue;
  const reason=source.status==='FUTURE_TIMESTAMP'?'CLOCK_SKEW':source.status==='NO_OBSERVATIONS'?'MISSING_DATA':'STALE_DATA';
  actions.push({sourceId:source.sourceId,action:'RAISE_HEALTH_ALERT',reason,priority:reason==='CLOCK_SKEW'?1:2});
 }
 actions.sort((a,b)=>a.priority-b.priority||a.sourceId.localeCompare(b.sourceId));
 return {mode:'PLAN_ONLY',alerts:actions.slice(0,limit),totalAlerts:actions.length,overflow:Math.max(0,actions.length-limit),
  retriesAttempted:0,externalNotificationsSent:0,collectorStarted:false,writeAuthorized:false,betRecommendationAuthorized:false};
}
