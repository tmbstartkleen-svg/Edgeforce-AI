import {db} from './db';
import {getAutomationHealth} from './automationHealth';
import {getOpsStatus} from './opsStatus';
import {loadIntelligenceReliabilityState} from './intelligenceReliability';
import {fetchFanDuelOddsPulse} from './providers/fanLineWire';

export type OpsHealthState='HEALTHY'|'DEGRADED'|'CRITICAL'|'UNKNOWN';
export type OpsCheck={
 id:string;label:string;state:OpsHealthState;value:number|null;unit:string;threshold:string;reason:string;
};

const ms=(n:number)=>Math.round(n);
function ageMinutes(value:unknown){if(!value)return null;const t=new Date(String(value)).getTime();return Number.isFinite(t)?Math.max(0,(Date.now()-t)/60000):null;}

export async function buildProductionObservability(){
 const sql=db();
 const [automation,ops,reliability,pulse]=await Promise.all([
  getAutomationHealth(),
  getOpsStatus(),
  loadIntelligenceReliabilityState(),
  fetchFanDuelOddsPulse().catch(()=>null)
 ]);
 const checks:OpsCheck[]=[];
 let dbLatencyMs:number|null=null;
 let latestMarketAgeMin:number|null=null;
 let latestConsensusAgeMin:number|null=null;
 let latestModelRunAgeMin:number|null=null;
 let latestAutomationAgeMin:number|null=null;
 let queryError:string|null=null;

 if(!sql){
  checks.push({id:'database',label:'Database connectivity',state:'CRITICAL',value:null,unit:'',threshold:'configured',reason:'DATABASE_URL is not configured.'});
 }else{
  const started=Date.now();
  try{
   const [probe]=await sql`select now() as now`;
   dbLatencyMs=Date.now()-started;
   checks.push({id:'database',label:'Database latency',state:dbLatencyMs<=250?'HEALTHY':dbLatencyMs<=750?'DEGRADED':'CRITICAL',value:ms(dbLatencyMs),unit:'ms',threshold:'healthy ≤250ms, critical >750ms',reason:'Round-trip database probe completed.'});
   const [fresh]=await sql`
    select
     (select max(pulled_at) from market_snapshots) as market_at,
     (select max(pulled_at) from market_consensus_snapshots) as consensus_at,
     (select max(created_at) from model_runs) as model_at,
     (select max(started_at) from automation_runs) as automation_at
   `;
   latestMarketAgeMin=ageMinutes(fresh?.market_at);
   latestConsensusAgeMin=ageMinutes(fresh?.consensus_at);
   latestModelRunAgeMin=ageMinutes(fresh?.model_at);
   latestAutomationAgeMin=ageMinutes(fresh?.automation_at);
  }catch(error){
   queryError=error instanceof Error?error.message:'database probe failed';
   checks.push({id:'database',label:'Database connectivity',state:'CRITICAL',value:null,unit:'',threshold:'query succeeds',reason:queryError});
  }
 }

 const pulseAgeMin=pulse?.ageMs==null?null:Number(pulse.ageMs)/60000;
 const pulsePriceCount=pulse?.rows?.reduce((sum,row)=>sum+row.prices.filter(p=>Number.isFinite(Number(p.american))).length,0)||0;
 const pulseUsable=Boolean(pulse?.ok&&pulse.fresh&&pulsePriceCount>0);
 const freshness=(id:string,label:string,value:number|null,healthy:number,critical:number,allowPulseContinuity=false)=>{
  let state:OpsHealthState=value===null?'UNKNOWN':value<=healthy?'HEALTHY':value<=critical?'DEGRADED':'CRITICAL';
  let reason=value===null?'No durable timestamp is available yet.':`${label} is ${Math.round(value)} minute(s) old.`;
  if(allowPulseContinuity&&pulseUsable&&(state==='CRITICAL'||state==='UNKNOWN')){
   state='DEGRADED';
   reason=`${reason} Fresh FanDuel pulse continuity is active (${pulsePriceCount} prices, ${(pulseAgeMin??0).toFixed(1)}m old).`;
  }
  checks.push({id,label,state,value:value===null?null:Math.round(value),unit:'min',threshold:`healthy ≤${healthy}m, critical >${critical}m`,reason});
 };
 freshness('market-freshness','Raw market snapshot freshness',latestMarketAgeMin,15,60,true);
 freshness('consensus-freshness','Consensus snapshot freshness',latestConsensusAgeMin,15,60,true);
 freshness('model-freshness','Model-run freshness',latestModelRunAgeMin,60,360);
 freshness('automation-freshness','Automation-run freshness',latestAutomationAgeMin,180,1440);

 checks.push({
  id:'reliability-mode',label:'Intelligence reliability mode',
  state:reliability.mode==='PROTECTIVE'?'CRITICAL':reliability.mode==='DEGRADED'?'DEGRADED':'HEALTHY',
  value:Math.round(reliability.score*100),unit:'%',threshold:'NORMAL mode; no required OPEN circuits',
  reason:`${reliability.mode}; open ${reliability.openComponents.length}, half-open ${reliability.halfOpenComponents.length}.`
 });

 checks.push({
  id:'automation-health',label:'Automation health',
  state:automation.failedCount>0||automation.staleCount>0?'CRITICAL':automation.pendingCount>0?'DEGRADED':'HEALTHY',
  value:automation.healthyCount,unit:'healthy jobs',threshold:'no failed/stale jobs',
  reason:`${automation.healthyCount} healthy, ${automation.pendingCount} pending, ${automation.failedCount} failed, ${automation.staleCount} stale.`
 });

 const incidents=((ops as any).incidents||[]) as Array<{severity?:string}>;
 const action=incidents.filter(x=>x.severity==='ACTION').length;
 const watch=incidents.filter(x=>x.severity==='WATCH').length;
 checks.push({id:'incidents',label:'Unresolved operational incidents',state:action>0?'CRITICAL':watch>0?'DEGRADED':'HEALTHY',value:action+watch,unit:'incidents',threshold:'0 ACTION incidents',reason:`${action} ACTION and ${watch} WATCH incident(s) unresolved.`});

 const critical=checks.filter(x=>x.state==='CRITICAL').length;
 const degraded=checks.filter(x=>x.state==='DEGRADED').length;
 const unknown=checks.filter(x=>x.state==='UNKNOWN').length;
 const healthy=checks.filter(x=>x.state==='HEALTHY').length;
 const overall:OpsHealthState=critical?'CRITICAL':degraded||unknown?'DEGRADED':'HEALTHY';
 const score=Math.max(0,Math.min(1,(healthy+degraded*.55+unknown*.25)/Math.max(1,checks.length)));
 return {
  generatedAt:new Date().toISOString(),overall,score,checks,
  summary:{healthy,degraded,critical,unknown,total:checks.length},
  automation,
  reliability,
  incidents:{action,watch,total:incidents.length},
  database:{configured:Boolean(sql),latencyMs:dbLatencyMs,error:queryError},
  freshness:{latestMarketAgeMin,latestConsensusAgeMin,latestModelRunAgeMin,latestAutomationAgeMin,pulseAgeMin,pulsePriceCount,pulseUsable},
  sla:{marketHealthyMin:15,marketCriticalMin:60,modelHealthyMin:60,modelCriticalMin:360,dbHealthyMs:250,dbCriticalMs:750},
  notes:['Operational health is fail-closed for database, automation and incident failures. During an explicit provider quota outage, a fresh real FanDuel pulse can downgrade stale normalized-market freshness from CRITICAL to DEGRADED but never to HEALTHY.','UNKNOWN freshness is treated as degraded until durable history exists.']
 };
}

export async function persistProductionObservability(report:Awaited<ReturnType<typeof buildProductionObservability>>){
 const sql=db();if(!sql)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from operational_health_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<5*60000)return {persisted:false};
 await sql`
  insert into operational_health_snapshots(observed_at,overall_state,health_score,healthy_checks,degraded_checks,critical_checks,unknown_checks,db_latency_ms,market_age_min,consensus_age_min,model_run_age_min,automation_age_min,action_incidents,watch_incidents,details)
  values(now(),${report.overall},${report.score},${report.summary.healthy},${report.summary.degraded},${report.summary.critical},${report.summary.unknown},${report.database.latencyMs},${report.freshness.latestMarketAgeMin},${report.freshness.latestConsensusAgeMin},${report.freshness.latestModelRunAgeMin},${report.freshness.latestAutomationAgeMin},${report.incidents.action},${report.incidents.watch},${sql.json({checks:report.checks,sla:report.sla} as any)})
 `;
 return {persisted:true};
}