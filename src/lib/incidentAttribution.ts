import {db} from './db';
import {buildProductionObservability} from './productionObservability';
import {RELEASE} from './releaseManifest';

export type IncidentCause='DATABASE'|'MARKET_FRESHNESS'|'CONSENSUS_FRESHNESS'|'MODEL_FRESHNESS'|'AUTOMATION'|'RELIABILITY'|'RUNTIME_INCIDENTS'|'UNKNOWN';
export type IncidentAttribution={
 primaryCause:IncidentCause;
 confidence:number;
 severity:'INFO'|'WATCH'|'ACTION';
 impactedComponents:string[];
 evidence:string[];
 remediation:string[];
 overall:string;
 generatedAt:string;
};

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function attributeOperationalIncident(obs:Awaited<ReturnType<typeof buildProductionObservability>>):IncidentAttribution{
 const candidates:Array<{cause:IncidentCause;score:number;component:string;evidence:string;remediation:string[]}>=[];

 const push=(cause:IncidentCause,score:number,component:string,evidence:string,remediation:string[])=>{
  if(score>0)candidates.push({cause,score,component,evidence,remediation});
 };

 const dbCheck=obs.checks.find(x=>x.id==='database');
 push('DATABASE',dbCheck?.state==='CRITICAL'?1:dbCheck?.state==='DEGRADED'?.65:0,'database',dbCheck?.reason||'database healthy',[
  'Verify database reachability and connection limits.',
  'Check recent migrations and provider/runtime connection strings.',
  'Keep release frozen until database health returns to non-critical.'
 ]);

 const market=obs.checks.find(x=>x.id==='market-freshness');
 push('MARKET_FRESHNESS',market?.state==='CRITICAL'?.95:market?.state==='DEGRADED'?.60:0,'market-feed',market?.reason||'market freshness healthy',[
  'Trigger live odds refresh and inspect provider circuit-breaker state.',
  'Verify THE_ODDS_API or configured primary provider credentials and quota.',
  'Do not promote stale market recommendations.'
 ]);

 const consensus=obs.checks.find(x=>x.id==='consensus-freshness');
 push('CONSENSUS_FRESHNESS',consensus?.state==='CRITICAL'?.90:consensus?.state==='DEGRADED'?.55:0,'consensus',consensus?.reason||'consensus freshness healthy',[
  'Refresh multi-provider consensus snapshots.',
  'Inspect provider disagreement and payload-freshness gates.',
  'Fall back to single-provider read-only mode if consensus is unavailable.'
 ]);

 const model=obs.checks.find(x=>x.id==='model-freshness');
 push('MODEL_FRESHNESS',model?.state==='CRITICAL'?.88:model?.state==='DEGRADED'?.52:0,'model-run',model?.reason||'model freshness healthy',[
  'Run recalibration/model refresh automation.',
  'Inspect failed model jobs and champion-drift controls.',
  'Retain current champion until fresh validation evidence exists.'
 ]);

 const automation=obs.checks.find(x=>x.id==='automation-health');
 push('AUTOMATION',automation?.state==='CRITICAL'?.92:automation?.state==='DEGRADED'?.58:0,'automation',automation?.reason||'automation healthy',[
  'Inspect failed or stale cron/automation jobs.',
  'Re-run the failed job only after fixing its dependency.',
  'Confirm injury, settlement, scan, decision, and recalibration schedules are current.'
 ]);

 const reliability=obs.checks.find(x=>x.id==='reliability-mode');
 push('RELIABILITY',reliability?.state==='CRITICAL'?.98:reliability?.state==='DEGRADED'?.68:0,'intelligence-stack',reliability?.reason||'reliability normal',[
  'Inspect open intelligence circuit breakers and their source components.',
  'Keep protective recommendation mode active until circuits recover.',
  'Require fresh successful probes before restoring normal weighting.'
 ]);

 const incidents=obs.checks.find(x=>x.id==='incidents');
 push('RUNTIME_INCIDENTS',incidents?.state==='CRITICAL'?.97:incidents?.state==='DEGRADED'?.62:0,'runtime-incidents',incidents?.reason||'no unresolved incidents',[
  'Resolve ACTION incidents before deployment promotion.',
  'Review incident metadata for the first failing subsystem.',
  'Confirm the incident is cleared in observability before reopening release flow.'
 ]);

 candidates.sort((a,b)=>b.score-a.score);
 const top=candidates[0];
 const secondary=candidates.filter(x=>top&&x.score>=top.score-.15);
 const primaryCause=top?.cause||'UNKNOWN';
 const confidence=top?clamp(top.score-(secondary.length>1?.08:0)):0.25;
 const severity=obs.overall==='CRITICAL'?'ACTION':obs.overall==='DEGRADED'?'WATCH':'INFO';
 const impactedComponents=[...new Set((secondary.length?secondary:candidates.slice(0,1)).map(x=>x.component))];
 const evidence=[...new Set((secondary.length?secondary:candidates.slice(0,2)).map(x=>x.evidence))];
 const remediation=[...new Set((secondary.length?secondary:candidates.slice(0,1)).flatMap(x=>x.remediation))];

 return {
  primaryCause,
  confidence,
  severity,
  impactedComponents,
  evidence:evidence.length?evidence:['No unhealthy operational signal currently dominates.'],
  remediation:remediation.length?remediation:['Continue scheduled observability checks; no intervention is required.'],
  overall:obs.overall,
  generatedAt:new Date().toISOString()
 };
}

export async function buildIncidentAttribution(){
 const obs=await buildProductionObservability();
 return {attribution:attributeOperationalIncident(obs),observability:obs};
}

export async function persistIncidentAttribution(report:Awaited<ReturnType<typeof buildIncidentAttribution>>){
 const sql=db();if(!sql)return {persisted:false};
 const a=report.attribution;
 await sql`
  insert into incident_attribution_snapshots(
   model_version,overall_state,primary_cause,confidence,severity,impacted_components,evidence,remediation
  ) values(
   ${RELEASE.modelVersion},${a.overall},${a.primaryCause},${a.confidence},${a.severity},
   ${sql.json(a.impactedComponents)},${sql.json(a.evidence)},${sql.json(a.remediation)}
  )
 `;
 return {persisted:true};
}

export async function loadIncidentAttributionSummary(){
 const current=await buildIncidentAttribution();
 const sql=db();
 if(!sql)return {...current,recent:[]};
 try{
  const recent=await sql`
   select id,model_version as "modelVersion",overall_state as "overallState",primary_cause as "primaryCause",
    confidence::float as confidence,severity,impacted_components as "impactedComponents",
    evidence,remediation,observed_at as "observedAt"
   from incident_attribution_snapshots order by observed_at desc limit 25
  `;
  return {...current,recent};
 }catch{return {...current,recent:[]}}
}
