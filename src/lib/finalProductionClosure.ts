import {db} from './db';
import {RELEASE} from './releaseManifest';
import {currentReleaseExecutionCertification} from './releaseExecutionCertification';
import {currentReleasePromotionProvenance} from './releasePromotionProvenance';
import {latestPostPromotionVerification} from './postPromotionVerification';
import {latestReleaseRollbackReconciliation} from './releaseRollbackReconciliation';
import {latestPlatformConvergence} from './releasePlatformConvergence';
import {latestAutomationRunForCommit} from './automationHealth';

export type FinalProductionClosure={
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 executionCertified:boolean;
 promotionVerified:boolean;
 postPromotionVerified:boolean;
 platformConverged:boolean;
 rollbackClear:boolean;
 closed:boolean;
 blockers:string[];
 evidence:Record<string,unknown>;
 source:string;
 workflowRunId:string|null;
};

export async function evaluateFinalProductionClosure(input:{commitSha:string;source?:string;workflowRunId?:string|null}):Promise<FinalProductionClosure>{
 const commitSha=String(input.commitSha||'');
 const [execution,promotion,postPromotion,convergence,rollback,settlementRun]=await Promise.all([
  currentReleaseExecutionCertification(),
  currentReleasePromotionProvenance(),
  latestPostPromotionVerification(),
  latestPlatformConvergence(),
  latestReleaseRollbackReconciliation(),
  latestAutomationRunForCommit('settle',commitSha)
 ]);
 const blockers:string[]=[];
 const topologyEvidence=(convergence?.evidence&&typeof convergence.evidence==='object'?convergence.evidence:{}) as any;
 const primaryStandby=topologyEvidence?.topology==='cloudflare-primary-vercel-standby';
 const primary=topologyEvidence?.primary||{};
 const standby=topologyEvidence?.standby||{};

 const legacyExecutionCertified=Boolean(execution?.certified&&String(execution?.commitSha||'')===commitSha);
 const legacyPromotionVerified=Boolean(
  promotion?.promoted
  &&!promotion?.rolledBack
  &&!(promotion?.blockers?.length)
  &&String(promotion?.commitSha||'')===commitSha
 );
 const legacyPostPromotionVerified=Boolean(
  postPromotion?.certified
  &&String(postPromotion?.deployedCommitSha||'')===commitSha
 );

 const executionCertified=primaryStandby
  ?Boolean(primary.exactMainCertified&&String(convergence?.commitSha||'')===commitSha)
  :legacyExecutionCertified;
 const promotionVerified=primaryStandby
  ?Boolean(convergence?.cloudflareVerified&&primary.platform==='cloudflare'&&primary.platformReady&&String(primary.commitSha||'')===commitSha)
  :legacyPromotionVerified;
 const postPromotionVerified=primaryStandby
  ?Boolean(convergence?.cloudflareVerified&&primary.hostedSmokePassed&&String(primary.commitSha||'')===commitSha)
  :legacyPostPromotionVerified;
 const platformConverged=primaryStandby
  ?Boolean(
    convergence?.certified
    &&String(convergence?.commitSha||'')===commitSha
    &&convergence?.cloudflareVerified
    &&convergence?.vercelVerified
    &&standby.healthy===true
    &&standby.manualOnly===true
    &&String(standby.state||'').toUpperCase()==='READY'
   )
  :Boolean(
    convergence?.certified
    &&String(convergence?.commitSha||'')===commitSha
    &&convergence?.vercelVerified
    &&convergence?.cloudflareVerified
   );
 const rollbackClear=!Boolean(
  rollback?.rollbackConfirmed
  &&String(rollback?.failedCommitSha||'')===commitSha
 );
 const expectedWorkflowRunId=String(input.workflowRunId||topologyEvidence?.workflowRunId||'');
 const settlementMetadata=(settlementRun?.metadata&&typeof settlementRun.metadata==='object'?settlementRun.metadata:{}) as any;
 const settlementResult=(settlementMetadata?.result&&typeof settlementMetadata.result==='object'?settlementMetadata.result:{}) as any;
 const settlementFallbackUsed=String(settlementResult?.mode||'').includes('score-fallback');
 const settlementMatchedLegs=Math.max(0,Number(settlementResult?.matchedLegs||0));
 const settlementIdentity=(settlementResult?.settlementIdentityMatches&&typeof settlementResult.settlementIdentityMatches==='object'
  ?settlementResult.settlementIdentityMatches:{}) as any;
 const identityInternal=Math.max(0,Number(settlementIdentity?.internalEventId||0));
 const identityFrozen=Math.max(0,Number(settlementIdentity?.frozenSourceEventId||0));
 const identityMapped=Math.max(0,Number(settlementIdentity?.eventProviderMapping||0));
 const identityReportedTotal=Math.max(0,Number(settlementIdentity?.total||0));
 const identitySummedTotal=identityInternal+identityFrozen+identityMapped;
 const settlementIdentityCertified=Boolean(
  settlementResult?.settlementIdentityMatches
  &&identityReportedTotal===settlementMatchedLegs
  &&identitySummedTotal===settlementMatchedLegs
 );
 const settlementIdentityCoverage=settlementMatchedLegs>0
  ?Number((identitySummedTotal/settlementMatchedLegs).toFixed(3))
  :settlementIdentityCertified?1:0;
 const settlementMappedIdentityShare=settlementMatchedLegs>0
  ?Number((identityMapped/settlementMatchedLegs).toFixed(3))
  :0;
 const settlementIdentityStrength=settlementMatchedLegs===0&&settlementIdentityCertified
  ?'NOOP'
  :settlementMatchedLegs>0&&identityMapped===0
    ?'DIRECT'
    :settlementMatchedLegs>0&&identityMapped===settlementMatchedLegs
      ?'MAPPED'
      :settlementMatchedLegs>0
        ?'MIXED'
        :'UNVERIFIED';
 const settlementWorkflowBound=Boolean(
  expectedWorkflowRunId
  &&String(settlementMetadata?.deploymentWorkflowRunId||'')===expectedWorkflowRunId
 );
 const settlementCertified=Boolean(
  settlementRun
  &&settlementRun.status==='success'
  &&String(settlementMetadata?.deploymentCommit||'')===commitSha
  &&settlementWorkflowBound
  &&settlementResult?.ok===true
  &&settlementIdentityCertified
  &&(!settlementFallbackUsed||settlementResult?.fallbackEvidenceCertified===true)
 );

 if(!commitSha||commitSha.length<7)blockers.push('release commit SHA is missing or invalid');
 if(!executionCertified)blockers.push(primaryStandby?'exact-main production certification is missing or failed':'execution certification is missing, failed, or belongs to a different commit');
 if(!promotionVerified)blockers.push(primaryStandby?'Cloudflare primary deployment identity or platform readiness is not verified':'production promotion provenance is missing, rolled back, blocked, or belongs to a different commit');
 if(!postPromotionVerified)blockers.push(primaryStandby?'Cloudflare primary hosted smoke verification is missing or failed':'post-promotion live verification is missing, failed, or belongs to a different commit');
 if(!platformConverged)blockers.push(primaryStandby?'Cloudflare primary and Vercel manual standby topology is not ready':'Vercel and Cloudflare are not converged on the same production commit');
 if(!rollbackClear)blockers.push('the candidate production commit has a confirmed rollback');
 if(!settlementWorkflowBound)blockers.push('settlement automation evidence is not bound to the current production workflow run');
 if(!settlementIdentityCertified)blockers.push('settlement identity telemetry does not fully reconcile with matched legs for the candidate commit');
 if(!settlementCertified)blockers.push('fresh successful settlement automation evidence is missing or uncertified for the candidate commit');

 return {
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  commitSha,
  executionCertified,promotionVerified,postPromotionVerified,platformConverged,rollbackClear,
  closed:blockers.length===0,
  blockers,
  evidence:{
   topology:primaryStandby?'cloudflare-primary-vercel-standby':'dual-active',
   primaryCommitSha:primary?.commitSha||null,
   standbyCommitSha:standby?.commitSha||null,
   standbyCommitDrift:Boolean(standby?.commitSha&&standby?.commitSha!==commitSha),
   standbyDeploymentId:standby?.deploymentId||null,
   executionId:execution?.id||null,
   promotionId:promotion?.id||null,
   postPromotionId:postPromotion?.id||null,
   convergenceId:convergence?.id||null,
   rollbackId:rollback?.id||null,
   settlementCertified,
   settlementCommitSha:settlementMetadata?.deploymentCommit||null,
   settlementWorkflowBound,
   settlementExpectedWorkflowRunId:expectedWorkflowRunId||null,
   settlementWorkflowRunId:settlementMetadata?.deploymentWorkflowRunId||null,
   settlementRunStartedAt:settlementRun?.startedAt?new Date(settlementRun.startedAt as any).toISOString():null,
   settlementMode:settlementResult?.mode||null,
   settlementNoop:Boolean(settlementResult?.settlementNoop),
   settlementMatchedLegs,
   settlementIdentityCertified,
   settlementIdentityCoverage,
   settlementMappedIdentityShare,
   settlementIdentityStrength,
   settlementIdentityMatches:settlementResult?.settlementIdentityMatches||null,
   settlementFallbackEvidenceCertified:settlementFallbackUsed?Boolean(settlementResult?.fallbackEvidenceCertified):null,
   evaluatedAt:new Date().toISOString()
  },
  source:input.source||'final-production-closure',
  workflowRunId:input.workflowRunId||null
 };
}

export async function saveFinalProductionClosure(report:FinalProductionClosure){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into release_final_closures(
   release_version,model_version,migration_version,commit_sha,
   execution_certified,promotion_verified,post_promotion_verified,platform_converged,
   rollback_clear,closed,blockers,evidence,source,workflow_run_id
  ) values(
   ${report.releaseVersion},${report.modelVersion},${report.migrationVersion},${report.commitSha},
   ${report.executionCertified},${report.promotionVerified},${report.postPromotionVerified},${report.platformConverged},
   ${report.rollbackClear},${report.closed},${sql.json(report.blockers)},${sql.json(report.evidence as any)},
   ${report.source},${report.workflowRunId}
  )
  on conflict (release_version,commit_sha) do update set
   execution_certified=excluded.execution_certified,
   promotion_verified=excluded.promotion_verified,
   post_promotion_verified=excluded.post_promotion_verified,
   platform_converged=excluded.platform_converged,
   rollback_clear=excluded.rollback_clear,
   closed=excluded.closed,
   blockers=excluded.blockers,
   evidence=excluded.evidence,
   source=excluded.source,
   workflow_run_id=excluded.workflow_run_id,
   created_at=now()
  returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

export async function latestFinalProductionClosure(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",
    execution_certified as "executionCertified",promotion_verified as "promotionVerified",
    post_promotion_verified as "postPromotionVerified",platform_converged as "platformConverged",
    rollback_clear as "rollbackClear",closed,blockers,evidence,source,
    workflow_run_id as "workflowRunId",created_at as "createdAt"
   from release_final_closures
   where release_version=${RELEASE.appVersion}
   order by created_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
