import {db} from './db';
import {evaluateReadiness} from './readiness';
import {latestProviderCertification} from './providerCertification';
import {ingestOdds} from './providers/ingest';
import {auditMarketBatch} from './dataQuality';
import {getAutomationHealth} from './automationHealth';
import {getOpsStatus} from './opsStatus';
import {
 securityHeaders,MAX_MUTATION_BYTES,READ_API_RATE_LIMIT,WRITE_API_RATE_LIMIT
} from './security';
import {RELEASE} from './releaseManifest';
import {getModelGovernanceStatus} from './modelGovernance';
import {getValidationLabStatus} from './validationLab';
import {championDriftStatus} from './mlChampionDrift';
import {shadowRecoveryStatus} from './mlShadowRecovery';
import {buildProductionObservability} from './productionObservability';
import {buildUnifiedIntelligenceCertification} from './unifiedIntelligence';
import {loadIntelligenceReliabilityState} from './intelligenceReliability';
import {buildSloGovernorReport} from './sloGovernor';
import {currentReleaseExecutionCertification} from './releaseExecutionCertification';
import {currentReleasePromotionProvenance} from './releasePromotionProvenance';
import {latestPostPromotionVerification} from './postPromotionVerification';
import {latestReleaseRollbackReconciliation} from './releaseRollbackReconciliation';

export type ProductionCertificationReport={
 certified:boolean;
 blockers:string[];
 warnings:string[];
 release:{
  build:string;
  version:string;
  modelVersion:string;
  migrationVersion:number;
  commit:string|null;
  environment:string;
 };
 readiness:Awaited<ReturnType<typeof evaluateReadiness>>;
 providerCertification:Awaited<ReturnType<typeof latestProviderCertification>>;
 dataQuality:ReturnType<typeof auditMarketBatch>;
 automation:Awaited<ReturnType<typeof getAutomationHealth>>;
 modelGovernance:Awaited<ReturnType<typeof getModelGovernanceStatus>>;
 modelValidation:Awaited<ReturnType<typeof getValidationLabStatus>>;
 championDrift:Awaited<ReturnType<typeof championDriftStatus>>;
 shadowRecovery:Awaited<ReturnType<typeof shadowRecoveryStatus>>;
 unifiedIntelligence:Awaited<ReturnType<typeof buildUnifiedIntelligenceCertification>>;
 reliability:Awaited<ReturnType<typeof loadIntelligenceReliabilityState>>;
sloGovernor:Awaited<ReturnType<typeof buildSloGovernorReport>>;
 executionCertification:Awaited<ReturnType<typeof currentReleaseExecutionCertification>>;
 promotionProvenance:Awaited<ReturnType<typeof currentReleasePromotionProvenance>>;
 postPromotionVerification:Awaited<ReturnType<typeof latestPostPromotionVerification>>;
 rollbackReconciliation:Awaited<ReturnType<typeof latestReleaseRollbackReconciliation>>;
 observability:Awaited<ReturnType<typeof buildProductionObservability>>;
 security:{
  ok:boolean;
  missingHeaders:string[];
  maxMutationBytes:number;
  readRateLimit:number;
  writeRateLimit:number;
 };
 ingestion:{
  source:string;
  mode:string;
  providerId:string|null;
  degraded:boolean;
  marketCount:number;
 };
 releaseAttestation:{
  found:boolean;
  version:string|null;
  buildPassed:boolean;
  smokePassed:boolean;
  loadPassed:boolean;
  readinessPassed:boolean;
 };
 incidents:{
  action:number;
  watch:number;
  info:number;
 };
 time:string;
};

function securityPosture(){
 const required=[
  'X-Content-Type-Options','X-Frame-Options','Strict-Transport-Security',
  'Content-Security-Policy','Permissions-Policy','Cross-Origin-Opener-Policy'
 ];
 const missingHeaders=required.filter(x=>!(securityHeaders as Record<string,string>)[x]);
 const csp=securityHeaders['Content-Security-Policy'];
 const ok=
  missingHeaders.length===0
  &&csp.includes("frame-ancestors 'none'")
  &&csp.includes("object-src 'none'")
  &&MAX_MUTATION_BYTES<=1_048_576
  &&WRITE_API_RATE_LIMIT<READ_API_RATE_LIMIT;
 return {ok,missingHeaders,maxMutationBytes:MAX_MUTATION_BYTES,readRateLimit:READ_API_RATE_LIMIT,writeRateLimit:WRITE_API_RATE_LIMIT};
}

export async function runProductionCertification(options:{strict?:boolean}={}):Promise<ProductionCertificationReport>{
 const environment=process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local';
 const strict=options.strict??(environment==='production'||process.env.REQUIRE_PRODUCTION_ENV==='true');
 const [readiness,providerCertification,ingestion,automation,ops,modelGovernance,modelValidation,championDrift,shadowRecovery,unifiedIntelligence,reliability,sloGovernor,observability,executionCertification,promotionProvenance,postPromotionVerification,rollbackReconciliation]=await Promise.all([
  evaluateReadiness({strict}),
  latestProviderCertification(),
  ingestOdds(),
  getAutomationHealth(),
  getOpsStatus(),
  getModelGovernanceStatus(),
  getValidationLabStatus(),
  championDriftStatus(),
  shadowRecoveryStatus(),
  buildUnifiedIntelligenceCertification(),
  loadIntelligenceReliabilityState(),
  buildSloGovernorReport(),
  buildProductionObservability(),
  currentReleaseExecutionCertification(),
  currentReleasePromotionProvenance(),
  latestPostPromotionVerification(),
  latestReleaseRollbackReconciliation()
 ]);
 const dataQuality=auditMarketBatch(ingestion.markets);
 const security=securityPosture();
 const blockers:string[]=[];
 const warnings:string[]=[];

 blockers.push(...readiness.requiredFailures.map(x=>`readiness: ${x}`));
 warnings.push(...readiness.warnings.map(x=>`readiness: ${x}`));

 if(!providerCertification){
  (strict?blockers:warnings).push('provider certification: no persisted certification run');
 }else{
  blockers.push(...providerCertification.blockers.map(x=>`provider: ${x}`));
  warnings.push(...providerCertification.warnings.map(x=>`provider: ${x}`));
  if(strict&&providerCertification.releaseVersion!==RELEASE.appVersion){
   blockers.push(`provider certification: latest run is app ${providerCertification.releaseVersion}, expected ${RELEASE.appVersion}`);
  }
  if(strict&&!providerCertification.launchReady)blockers.push('provider certification: launchReady is false');
 }

 blockers.push(...dataQuality.blockers.map(x=>`data: ${x}`));
 warnings.push(...dataQuality.warnings.map(x=>`data: ${x}`));
 if(dataQuality.grade==='REJECT')blockers.push('data: batch quality grade is REJECT');

 blockers.push(...automation.blockers.map(x=>`automation: ${x}`));
 warnings.push(...automation.warnings.map(x=>`automation: ${x}`));

 if(modelGovernance.latestRun?.status==='failed')blockers.push('model governance: latest governance run failed');
 if(!modelGovernance.latestRun)warnings.push('model governance: no completed governance run yet');
 if(modelGovernance.summary.critical>0)warnings.push(`model governance: ${modelGovernance.summary.critical} critical model group(s) are runtime-braked`);
 if(modelGovernance.summary.drifting>0)warnings.push(`model governance: ${modelGovernance.summary.drifting} drifting model group(s) are runtime-braked`);

 if(modelValidation.latestRun?.status==='failed')blockers.push('model validation: latest validation run failed');
 if(!modelValidation.latestRun)warnings.push('model validation: no durable validation run yet');
 if(modelValidation.report.evidence.failed>0)warnings.push(`model validation: ${modelValidation.report.evidence.failed} model group(s) failed evidence gates and are runtime-braked`);
 if(modelValidation.report.sampleSize>=75&&modelValidation.report.evidence.promotionEligible===0)warnings.push('model validation: settled history exists but no model group is currently evidence-qualified');

 if(championDrift.latestRun?.status==='failed')blockers.push('external ML champion drift: latest monitor run failed');
 if(!championDrift.latestRun)warnings.push('external ML champion drift: no completed monitor run yet');
 if(Number(championDrift.latestRun?.critical||0)>0)warnings.push('external ML champion drift: '+Number(championDrift.latestRun?.critical||0)+' champion(s) are in CRITICAL confirmation state');
 if(Number(championDrift.latestRun?.quarantined||0)>0)warnings.push('external ML champion drift: '+Number(championDrift.latestRun?.quarantined||0)+' champion(s) were quarantined and reverted to native fallback');

 if(shadowRecovery.latestRun?.status==='failed')blockers.push('external ML shadow league: latest recovery run failed');
 if(Number(shadowRecovery.latestRun?.leagueWinnersReady||0)>0)warnings.push('external ML shadow league: '+Number(shadowRecovery.latestRun?.leagueWinnersReady||0)+' live league leader(s) are awaiting or eligible for recovery');
 if(Number(shadowRecovery.latestRun?.rejected||0)>0)warnings.push('external ML shadow league: '+Number(shadowRecovery.latestRun?.rejected||0)+' challenger(s) failed live evidence');

 if(unifiedIntelligence.state==='BLOCKED')blockers.push(...unifiedIntelligence.blockers.map(x=>`unified intelligence: ${x}`));
 if(unifiedIntelligence.state==='DEGRADED')warnings.push(`unified intelligence: stack score ${(unifiedIntelligence.score*100).toFixed(1)}%, critical coverage ${(unifiedIntelligence.criticalCoverage*100).toFixed(1)}%`);
 warnings.push(...unifiedIntelligence.warnings.map(x=>`unified intelligence: ${x}`));
 if(reliability.mode==='PROTECTIVE')blockers.push(`reliability: protective mode active; open components ${reliability.openComponents.join(', ')||'required system'}`);
 else if(reliability.mode==='DEGRADED')warnings.push(`reliability: degraded mode; open ${reliability.openComponents.join(', ')||'none'}, half-open ${reliability.halfOpenComponents.join(', ')||'none'}`);
 if(reliability.criticalOpen)blockers.push('reliability: required intelligence circuit is open');
 if(sloGovernor.state==='FROZEN'||sloGovernor.freezeTriggered)(strict?blockers:warnings).push(`SLO: deployment freeze active; ${sloGovernor.reasons.join('; ')||'error budget exhausted'}`);
 else if(sloGovernor.state==='RECOVERING')warnings.push(`SLO: deployment budget recovering (${sloGovernor.recoveryStreak}/3 safe checks)`);
 warnings.push(...sloGovernor.warnings.map(x=>`SLO: ${x}`));

 if(!security.ok)blockers.push(...security.missingHeaders.map(x=>`security: missing ${x}`));
 if(strict&&ingestion.source!=='live')blockers.push(`data: strict production certification requires live odds, current source is ${ingestion.source}`);
 if(strict&&ingestion.markets.length===0)blockers.push('data: no sportsbook markets available for strict production certification');

 const attestations=(ops as any).attestations||[];
 const currentAttestation=attestations.find((x:any)=>String(x.version)===RELEASE.appVersion)||null;
 const releaseAttestation={
  found:Boolean(currentAttestation),
  version:currentAttestation?String(currentAttestation.version):null,
  buildPassed:Boolean(currentAttestation?.buildPassed),
  smokePassed:Boolean(currentAttestation?.smokePassed),
  loadPassed:Boolean(currentAttestation?.loadPassed),
  readinessPassed:Boolean(currentAttestation?.readinessPassed)
 };
 if(strict&&!releaseAttestation.found)blockers.push('release: current-version release attestation not found');
 if(strict&&releaseAttestation.found&&!(releaseAttestation.buildPassed&&releaseAttestation.smokePassed&&releaseAttestation.loadPassed&&releaseAttestation.readinessPassed)){
  blockers.push('release: current-version attestation is incomplete or failed');
 }

 const unresolved=((ops as any).incidents||[]) as Array<{severity?:string}>;
 const incidents={
  action:unresolved.filter(x=>x.severity==='ACTION').length,
  watch:unresolved.filter(x=>x.severity==='WATCH').length,
  info:unresolved.filter(x=>x.severity==='INFO').length
 };
 if(incidents.action>0)warnings.push(`operations: ${incidents.action} unresolved ACTION incident(s)`);
 if(incidents.watch>0)warnings.push(`operations: ${incidents.watch} unresolved WATCH incident(s)`);

 if(observability.overall==='CRITICAL'){
  (strict?blockers:warnings).push('observability: production health is CRITICAL');
 }else if(observability.overall==='DEGRADED')warnings.push('observability: production health is DEGRADED');

 if(!executionCertification){
  (strict?blockers:warnings).push('release execution: current-release execution certificate not found');
 }else{
  if(strict&&executionCertification.certified!==true)blockers.push('release execution: current-release execution certificate is not certified');
  const deployCommit=process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null;
  if(strict&&deployCommit&&String(executionCertification.commitSha)!==String(deployCommit)){
   blockers.push(`release execution: certified commit ${String(executionCertification.commitSha)} does not match deployed commit ${deployCommit}`);
  }
 }

 if(!promotionProvenance){
  warnings.push('release promotion provenance: current release has not recorded a completed production promotion yet');
 }else{
  const deployCommit=process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null;
  if(strict&&promotionProvenance.promoted!==true)blockers.push('release promotion provenance: current release is not marked promoted');
  if(strict&&promotionProvenance.rolledBack===true)blockers.push('release promotion provenance: current release was rolled back');
  if(strict&&promotionProvenance.blockers.length>0)blockers.push('release promotion provenance: stored promotion evidence contains blockers');
  if(strict&&deployCommit&&String(promotionProvenance.commitSha)!==String(deployCommit)){
   blockers.push(`release promotion provenance: promoted commit ${String(promotionProvenance.commitSha)} does not match deployed commit ${deployCommit}`);
  }
 }

 if(!postPromotionVerification){
  warnings.push('post-promotion verification: current release has not recorded a live verification certificate yet');
 }else{
  const deployCommit=process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null;
  if(strict&&postPromotionVerification.certified!==true)blockers.push('post-promotion verification: latest current-release live verification is not certified');
  if(strict&&deployCommit&&String(postPromotionVerification.deployedCommitSha)!==String(deployCommit)){
   blockers.push(`post-promotion verification: verified live commit ${String(postPromotionVerification.deployedCommitSha)} does not match deployed commit ${deployCommit}`);
  }
 }

 if(!rollbackReconciliation){
  warnings.push('rollback reconciliation: no rollback event is recorded for the current release');
 }else if(rollbackReconciliation.rollbackConfirmed===true){
  const failedCommit=String(rollbackReconciliation.failedCommitSha||'');
  const deployCommit=process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null;
  if(strict&&(!deployCommit||failedCommit===String(deployCommit))){
   blockers.push(`rollback reconciliation: current release commit ${failedCommit||'unknown'} was rolled back and is not eligible for certification`);
  }else if(deployCommit&&failedCommit&&failedCommit!==String(deployCommit)){
   warnings.push(`rollback reconciliation: historical rollback commit ${failedCommit} differs from current runtime commit ${deployCommit}; repaired commit may proceed`);
  }
 }

 const certified=readiness.ready&&blockers.length===0;
 return {
  certified,blockers:[...new Set(blockers)],warnings:[...new Set(warnings)],
  release:{
   build:RELEASE.build,version:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,
   migrationVersion:RELEASE.migrationVersion,commit:process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null,
   environment
  },
  readiness,providerCertification,dataQuality,automation,modelGovernance,modelValidation,championDrift,shadowRecovery,unifiedIntelligence,reliability,sloGovernor,observability,security,
  executionCertification,promotionProvenance,postPromotionVerification,rollbackReconciliation,
  ingestion:{
   source:ingestion.source,mode:ingestion.mode,providerId:ingestion.providerId||null,
   degraded:Boolean(ingestion.degraded),marketCount:ingestion.markets.length
  },
  releaseAttestation,incidents,time:new Date().toISOString()
 };
}

export async function saveProductionCertification(report:ProductionCertificationReport){
 const sql=db();
 if(!sql)return {mode:'memory' as const,id:null};
 try{
  const [row]=await sql`
   insert into production_certifications(
    release_version,model_version,commit_sha,environment,certified,blockers,warnings,report
   ) values(
    ${RELEASE.appVersion},${RELEASE.modelVersion},${process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null},
    ${process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local'},${report.certified},
    ${sql.json(report.blockers)},${sql.json(report.warnings)},${sql.json(report as any)}
   ) returning id
  `;
  return {mode:'database' as const,id:Number(row.id)};
 }catch{
  return {mode:'database' as const,id:null};
 }
}

export async function latestProductionCertification(){
 const sql=db();
 if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    commit_sha as "commitSha",environment,certified,blockers,warnings,report,
    created_at as "createdAt"
   from production_certifications order by created_at desc limit 1
  `;
  return row||null;
 }catch{
  return null;
 }
}
