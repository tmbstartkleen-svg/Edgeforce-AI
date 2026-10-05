import {db} from './db';
import {RELEASE} from './releaseManifest';

export type RollbackReconciliationInput={
 failedCommitSha:string;
 failedDeploymentUrl:string;
 restoredDeploymentId?:string|null;
 restoredDeploymentUrl?:string|null;
 platform:string;
 source:string;
 workflowRunId?:string|null;
 workflowRunAttempt?:string|null;
 launchId?:string|null;
};

export type RollbackReconciliation={
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 failedCommitSha:string;
 failedDeploymentUrl:string;
 restoredDeploymentId:string|null;
 restoredDeploymentUrl:string|null;
 platform:string;
 source:string;
 workflowRunId:string|null;
 workflowRunAttempt:string|null;
 launchId:string|null;
 promotionReconciled:boolean;
 verificationInvalidated:boolean;
 rollbackConfirmed:boolean;
 blockers:string[];
 evidence:Record<string,unknown>;
};

export async function reconcileReleaseRollback(input:RollbackReconciliationInput):Promise<RollbackReconciliation>{
 const sql=db();
 const blockers:string[]=[];
 if(!input.failedCommitSha||input.failedCommitSha.length<7)blockers.push('failed commit SHA is missing or invalid');
 if(!/^https:\/\//.test(input.failedDeploymentUrl))blockers.push('failed deployment URL is missing or invalid');
 if(input.restoredDeploymentUrl&&!/^https:\/\//.test(input.restoredDeploymentUrl))blockers.push('restored deployment URL is invalid');
 if(!['vercel','cloudflare'].includes(input.platform))blockers.push('deployment platform is unsupported');

 let promotionReconciled=false;
 let verificationInvalidated=false;
 if(sql&&blockers.length===0){
  try{
   const promoted=await sql`
    update release_promotion_provenance
    set rolled_back=true,
        blockers=case
          when blockers @> '["release was rolled back"]'::jsonb then blockers
          else blockers || '["release was rolled back"]'::jsonb
        end,
        evidence=coalesce(evidence,'{}'::jsonb) || ${sql.json({
          rollbackReconciled:true,
          restoredDeploymentId:input.restoredDeploymentId||null,
          restoredDeploymentUrl:input.restoredDeploymentUrl||null
        } as any)}
    where release_version=${RELEASE.appVersion}
      and model_version=${RELEASE.modelVersion}
      and migration_version=${RELEASE.migrationVersion}
      and commit_sha=${input.failedCommitSha}
    returning id
   `;
   promotionReconciled=promoted.length>0;
  }catch{}

  try{
   const invalidated=await sql`
    update release_post_promotion_verifications
    set certified=false,
        blockers=case
          when blockers @> '["deployment rolled back"]'::jsonb then blockers
          else blockers || '["deployment rolled back"]'::jsonb
        end,
        evidence=coalesce(evidence,'{}'::jsonb) || ${sql.json({
          rollbackReconciled:true,
          restoredDeploymentId:input.restoredDeploymentId||null,
          restoredDeploymentUrl:input.restoredDeploymentUrl||null
        } as any)}
    where release_version=${RELEASE.appVersion}
      and model_version=${RELEASE.modelVersion}
      and migration_version=${RELEASE.migrationVersion}
      and deployed_commit_sha=${input.failedCommitSha}
    returning id
   `;
   verificationInvalidated=invalidated.length>0;
  }catch{}
 }

 const rollbackConfirmed=blockers.length===0&&Boolean(input.restoredDeploymentId||input.restoredDeploymentUrl);
 if(!rollbackConfirmed)blockers.push('restored production deployment identity was not recorded');

 const report:RollbackReconciliation={
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  failedCommitSha:input.failedCommitSha,
  failedDeploymentUrl:input.failedDeploymentUrl,
  restoredDeploymentId:input.restoredDeploymentId||null,
  restoredDeploymentUrl:input.restoredDeploymentUrl||null,
  platform:input.platform,
  source:input.source,
  workflowRunId:input.workflowRunId||null,
  workflowRunAttempt:input.workflowRunAttempt||null,
  launchId:input.launchId||null,
  promotionReconciled,verificationInvalidated,rollbackConfirmed,
  blockers,
  evidence:{reconciledAt:new Date().toISOString()}
 };

 if(sql){
  try{
   await sql`
    insert into release_rollback_reconciliations(
      release_version,model_version,migration_version,failed_commit_sha,failed_deployment_url,
      restored_deployment_id,restored_deployment_url,platform,source,workflow_run_id,
      workflow_run_attempt,launch_id,promotion_reconciled,verification_invalidated,
      rollback_confirmed,blockers,evidence
    ) values(
      ${report.releaseVersion},${report.modelVersion},${report.migrationVersion},${report.failedCommitSha},
      ${report.failedDeploymentUrl},${report.restoredDeploymentId},${report.restoredDeploymentUrl},
      ${report.platform},${report.source},${report.workflowRunId},${report.workflowRunAttempt},${report.launchId},
      ${report.promotionReconciled},${report.verificationInvalidated},${report.rollbackConfirmed},
      ${sql.json(report.blockers)},${sql.json(report.evidence as any)}
    )
   `;
  }catch{}
 }
 return report;
}

export async function latestReleaseRollbackReconciliation(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",failed_commit_sha as "failedCommitSha",
    failed_deployment_url as "failedDeploymentUrl",restored_deployment_id as "restoredDeploymentId",
    restored_deployment_url as "restoredDeploymentUrl",platform,source,
    workflow_run_id as "workflowRunId",workflow_run_attempt as "workflowRunAttempt",
    launch_id as "launchId",promotion_reconciled as "promotionReconciled",
    verification_invalidated as "verificationInvalidated",rollback_confirmed as "rollbackConfirmed",
    blockers,evidence,created_at as "createdAt"
   from release_rollback_reconciliations
   where release_version=${RELEASE.appVersion}
   order by created_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
