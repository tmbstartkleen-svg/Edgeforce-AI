import {db} from './db';
import {RELEASE} from './releaseManifest';
import {currentReleaseExecutionCertification} from './releaseExecutionCertification';
import {currentReleasePromotionProvenance} from './releasePromotionProvenance';
import {latestPostPromotionVerification} from './postPromotionVerification';
import {latestReleaseRollbackReconciliation} from './releaseRollbackReconciliation';
import {latestPlatformConvergence} from './releasePlatformConvergence';

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
 const [execution,promotion,postPromotion,convergence,rollback]=await Promise.all([
  currentReleaseExecutionCertification(),
  currentReleasePromotionProvenance(),
  latestPostPromotionVerification(),
  latestPlatformConvergence(),
  latestReleaseRollbackReconciliation()
 ]);
 const commitSha=String(input.commitSha||'');
 const blockers:string[]=[];
 const executionCertified=Boolean(execution?.certified&&String(execution?.commitSha||'')===commitSha);
 const promotionVerified=Boolean(
  promotion?.promoted
  &&!promotion?.rolledBack
  &&!(promotion?.blockers?.length)
  &&String(promotion?.commitSha||'')===commitSha
 );
 const postPromotionVerified=Boolean(
  postPromotion?.certified
  &&String(postPromotion?.deployedCommitSha||'')===commitSha
 );
 const platformConverged=Boolean(
  convergence?.certified
  &&String(convergence?.commitSha||'')===commitSha
  &&convergence?.vercelVerified
  &&convergence?.cloudflareVerified
 );
 const rollbackClear=!Boolean(
  rollback?.rollbackConfirmed
  &&String(rollback?.failedCommitSha||'')===commitSha
 );

 if(!commitSha||commitSha.length<7)blockers.push('release commit SHA is missing or invalid');
 if(!executionCertified)blockers.push('execution certification is missing, failed, or belongs to a different commit');
 if(!promotionVerified)blockers.push('production promotion provenance is missing, rolled back, blocked, or belongs to a different commit');
 if(!postPromotionVerified)blockers.push('post-promotion live verification is missing, failed, or belongs to a different commit');
 if(!platformConverged)blockers.push('Vercel and Cloudflare are not converged on the same production commit');
 if(!rollbackClear)blockers.push('the candidate production commit has a confirmed rollback');

 return {
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  commitSha,
  executionCertified,promotionVerified,postPromotionVerified,platformConverged,rollbackClear,
  closed:blockers.length===0,
  blockers,
  evidence:{
   executionId:execution?.id||null,
   promotionId:promotion?.id||null,
   postPromotionId:postPromotion?.id||null,
   convergenceId:convergence?.id||null,
   rollbackId:rollback?.id||null,
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
