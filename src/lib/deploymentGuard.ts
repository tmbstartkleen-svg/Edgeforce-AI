import {db} from './db';
import {RELEASE} from './releaseManifest';
import {latestProductionCertification} from './productionCertification';
import {buildProductionObservability} from './productionObservability';
import {loadIntelligenceReliabilityState} from './intelligenceReliability';
import {evaluateReadiness} from './readiness';

export type DeploymentGuardSnapshot={
 releaseVersion:string|null;
 modelVersion:string|null;
 ready:boolean;
 productionReady:boolean;
 certified:boolean;
 observabilityOverall:string;
 observabilityScore:number;
 criticalChecks:number;
 degradedChecks:number;
 reliabilityMode:string;
 reliabilityScore:number;
 openCircuits:number;
 halfOpenCircuits:number;
 automationFailed:number;
 automationStale:number;
 actionIncidents:number;
 watchIncidents:number;
 latestMarketAgeMin:number|null;
 latestModelRunAgeMin:number|null;
 pulseUsable:boolean;
 capturedAt:string;
};

export type DeploymentGuardDecision={
 decision:'PASS'|'BLOCK';
 hardBlock:boolean;
 blockers:string[];
 warnings:string[];
 scoreDelta:number;
 reliabilityDelta:number;
 criticalCheckDelta:number;
};

const num=(v:unknown,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback};
const nullableNum=(v:unknown)=>{const n=Number(v);return v===null||v===undefined||!Number.isFinite(n)?null:n};

export function normalizeDeploymentBaseline(raw:any):DeploymentGuardSnapshot{
 return {
  releaseVersion:raw?.releaseVersion?String(raw.releaseVersion):raw?.version?String(raw.version):null,
  modelVersion:raw?.modelVersion?String(raw.modelVersion):null,
  ready:Boolean(raw?.ready),
  productionReady:Boolean(raw?.productionReady??raw?.ready),
  certified:Boolean(raw?.certified??raw?.productionReady??raw?.ready),
  observabilityOverall:String(raw?.observabilityOverall??raw?.overall??'UNKNOWN'),
  observabilityScore:num(raw?.observabilityScore??raw?.score,.5),
  criticalChecks:Math.max(0,Math.round(num(raw?.criticalChecks??raw?.critical,0))),
  degradedChecks:Math.max(0,Math.round(num(raw?.degradedChecks??raw?.degraded,0))),
  reliabilityMode:String(raw?.reliabilityMode??raw?.mode??'DEGRADED'),
  reliabilityScore:num(raw?.reliabilityScore??raw?.reliability?.score,.55),
  openCircuits:Math.max(0,Math.round(num(raw?.openCircuits??raw?.openCount,0))),
  halfOpenCircuits:Math.max(0,Math.round(num(raw?.halfOpenCircuits??raw?.halfOpenCount,0))),
  automationFailed:Math.max(0,Math.round(num(raw?.automationFailed,0))),
  automationStale:Math.max(0,Math.round(num(raw?.automationStale,0))),
  actionIncidents:Math.max(0,Math.round(num(raw?.actionIncidents,0))),
  watchIncidents:Math.max(0,Math.round(num(raw?.watchIncidents,0))),
  latestMarketAgeMin:nullableNum(raw?.latestMarketAgeMin),
  latestModelRunAgeMin:nullableNum(raw?.latestModelRunAgeMin),
  pulseUsable:Boolean(raw?.pulseUsable),
  capturedAt:String(raw?.capturedAt||new Date().toISOString())
 };
}

export async function captureDeploymentGuardSnapshot():Promise<DeploymentGuardSnapshot>{
 const [cert,observability,reliability,readiness]=await Promise.all([
  latestProductionCertification(),
  buildProductionObservability(),
  loadIntelligenceReliabilityState(),
  evaluateReadiness({strict:true})
 ]);
 const certReport=(cert as any)?.report||{};
 const currentVersion=String((cert as any)?.releaseVersion||'')===RELEASE.appVersion;
 return {
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  ready:Boolean(readiness.ready),
  productionReady:Boolean(readiness.productionReady),
  certified:currentVersion&&Boolean((cert as any)?.certified??certReport?.certified),
  observabilityOverall:String(observability.overall),
  observabilityScore:num(observability.score),
  criticalChecks:num(observability.summary?.critical),
  degradedChecks:num(observability.summary?.degraded),
  reliabilityMode:String(reliability.mode),
  reliabilityScore:num(reliability.score),
  openCircuits:reliability.openComponents.length,
  halfOpenCircuits:reliability.halfOpenComponents.length,
  automationFailed:num((observability as any).automation?.failedCount),
  automationStale:num((observability as any).automation?.staleCount),
  actionIncidents:num(observability.incidents?.action),
  watchIncidents:num(observability.incidents?.watch),
  latestMarketAgeMin:nullableNum(observability.freshness?.latestMarketAgeMin),
  latestModelRunAgeMin:nullableNum(observability.freshness?.latestModelRunAgeMin),
  pulseUsable:Boolean(observability.freshness?.pulseUsable),
  capturedAt:new Date().toISOString()
 };
}

export function evaluateDeploymentGuard(baselineInput:DeploymentGuardSnapshot,candidateInput:DeploymentGuardSnapshot):DeploymentGuardDecision{
 const baseline=normalizeDeploymentBaseline(baselineInput);
 const candidate=normalizeDeploymentBaseline(candidateInput);
 const blockers:string[]=[];
 const warnings:string[]=[];
 let hardBlock=false;
 const scoreDelta=candidate.observabilityScore-baseline.observabilityScore;
 const reliabilityDelta=candidate.reliabilityScore-baseline.reliabilityScore;
 const criticalCheckDelta=candidate.criticalChecks-baseline.criticalChecks;

 if(candidate.releaseVersion!==RELEASE.appVersion){
  blockers.push(`candidate release ${candidate.releaseVersion||'unknown'} does not match expected ${RELEASE.appVersion}`);
  hardBlock=true;
 }
 if(!candidate.ready||!candidate.productionReady){
  blockers.push('candidate readiness is false');
  hardBlock=true;
 }
 if(!candidate.certified){
  blockers.push('candidate does not have a current successful production certification');
  hardBlock=true;
 }
 const inheritedCriticalContinuity=
  candidate.observabilityOverall==='CRITICAL'&&
  candidate.pulseUsable&&
  baseline.observabilityOverall==='CRITICAL'&&
  candidate.criticalChecks<=baseline.criticalChecks&&
  candidate.actionIncidents<=baseline.actionIncidents&&
  candidate.automationFailed<=baseline.automationFailed&&
  candidate.automationStale<=baseline.automationStale&&
  scoreDelta>=-.05;
 if(candidate.observabilityOverall==='CRITICAL'){
  if(inheritedCriticalContinuity){
   warnings.push('candidate remains CRITICAL only within non-regressing inherited remediation state under fresh real pulse continuity');
  }else{
   blockers.push('candidate observability is CRITICAL');
   hardBlock=true;
  }
 }
 const inheritedProtectiveContinuity=
  candidate.reliabilityMode==='PROTECTIVE'&&
  candidate.pulseUsable&&
  baseline.reliabilityMode==='PROTECTIVE'&&
  candidate.openCircuits<=baseline.openCircuits&&
  reliabilityDelta>=-.07;
 if(candidate.reliabilityMode==='PROTECTIVE'){
  if(inheritedProtectiveContinuity){
   warnings.push('candidate remains in inherited PROTECTIVE mode under fresh real pulse continuity');
  }else{
   blockers.push('candidate reliability supervisor is in PROTECTIVE mode');
   hardBlock=true;
  }
 }
 if(candidate.actionIncidents>baseline.actionIncidents){
  blockers.push(`ACTION incidents increased from ${baseline.actionIncidents} to ${candidate.actionIncidents}`);
  hardBlock=true;
 }
 if(candidate.criticalChecks>baseline.criticalChecks)blockers.push(`critical observability checks increased from ${baseline.criticalChecks} to ${candidate.criticalChecks}`);
 if(candidate.automationFailed>baseline.automationFailed)blockers.push(`failed automations increased from ${baseline.automationFailed} to ${candidate.automationFailed}`);
 if(candidate.automationStale>baseline.automationStale)blockers.push(`stale automations increased from ${baseline.automationStale} to ${candidate.automationStale}`);
 if(scoreDelta<=-.12&&candidate.observabilityScore<.78)blockers.push(`observability score regressed ${Math.abs(scoreDelta*100).toFixed(1)} points`);
 if(reliabilityDelta<=-.15&&candidate.reliabilityScore<.75)blockers.push(`reliability score regressed ${Math.abs(reliabilityDelta*100).toFixed(1)} points`);
 const marketLimit=Math.max(60,(baseline.latestMarketAgeMin??0)+30);
 if(candidate.latestMarketAgeMin!==null&&candidate.latestMarketAgeMin>marketLimit)blockers.push(`market freshness regressed to ${candidate.latestMarketAgeMin.toFixed(0)} minutes`);
 if(candidate.degradedChecks>baseline.degradedChecks)warnings.push(`degraded checks increased by ${candidate.degradedChecks-baseline.degradedChecks}`);
 if(scoreDelta<-.05&&scoreDelta>-.12)warnings.push(`observability score slipped ${Math.abs(scoreDelta*100).toFixed(1)} points`);
 if(reliabilityDelta<-.07&&reliabilityDelta>-.15)warnings.push(`reliability score slipped ${Math.abs(reliabilityDelta*100).toFixed(1)} points`);
 if(candidate.watchIncidents>baseline.watchIncidents)warnings.push(`WATCH incidents increased by ${candidate.watchIncidents-baseline.watchIncidents}`);
 if(candidate.reliabilityMode==='DEGRADED'&&baseline.reliabilityMode==='NORMAL')warnings.push('candidate reliability moved from NORMAL to DEGRADED');

 return {decision:blockers.length?'BLOCK':'PASS',hardBlock,blockers,warnings,scoreDelta,reliabilityDelta,criticalCheckDelta};
}

export async function persistDeploymentGuardRun(input:{launchId?:string|null;baseline:DeploymentGuardSnapshot;candidate:DeploymentGuardSnapshot;result:DeploymentGuardDecision}){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into deployment_guard_runs(
   launch_id,candidate_version,baseline_version,decision,hard_block,score_delta,reliability_delta,
   critical_check_delta,blockers,warnings,baseline,candidate
  ) values(
   ${input.launchId||null},${input.candidate.releaseVersion||RELEASE.appVersion},${input.baseline.releaseVersion||null},
   ${input.result.decision},${input.result.hardBlock},${input.result.scoreDelta},${input.result.reliabilityDelta},
   ${input.result.criticalCheckDelta},${sql.json(input.result.blockers)},${sql.json(input.result.warnings)},
   ${sql.json(input.baseline as any)},${sql.json(input.candidate as any)}
  ) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

export async function loadDeploymentGuardSummary(){
 const sql=db();if(!sql)return {latest:null,recent:[]};
 try{
  const rows=await sql`
   select id,launch_id as "launchId",candidate_version as "candidateVersion",baseline_version as "baselineVersion",
    decision,hard_block as "hardBlock",score_delta::float as "scoreDelta",reliability_delta::float as "reliabilityDelta",
    critical_check_delta as "criticalCheckDelta",blockers,warnings,created_at as "createdAt"
   from deployment_guard_runs order by created_at desc limit 30
  `;
  return {latest:(rows as any[])[0]||null,recent:rows};
 }catch{return {latest:null,recent:[]}}
}
