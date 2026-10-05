import {db} from './db';
import {RELEASE} from './releaseManifest';
import {currentReleaseExecutionCertification} from './releaseExecutionCertification';
import {currentReleasePromotionProvenance} from './releasePromotionProvenance';

export type PostPromotionVerification={
 certified:boolean;
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 deployedCommitSha:string;
 promotionCommitSha:string;
 executionCommitSha:string;
 deploymentUrl:string;
 platform:string;
 source:string;
 workflowRunId:string|null;
 provenanceId:number|null;
 executionCertified:boolean;
 promotionVerified:boolean;
 runtimeIdentityVerified:boolean;
 commitIdentityVerified:boolean;
 blockers:string[];
 evidence:Record<string,unknown>;
};

export async function evaluatePostPromotionVerification(input:{
 deploymentUrl:string;
 platform:string;
 source?:string;
 workflowRunId?:string|null;
 runtime?:{version?:string;modelVersion?:string;migrationVersion?:number;commitSha?:string|null};
}):Promise<PostPromotionVerification>{
 const [execution,promotion]=await Promise.all([
  currentReleaseExecutionCertification(),
  currentReleasePromotionProvenance()
 ]);
 const deployedCommit=String(input.runtime?.commitSha||process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||'');
 const blockers:string[]=[];
 const runtimeIdentityVerified=
  input.runtime?.version===RELEASE.appVersion
  &&input.runtime?.modelVersion===RELEASE.modelVersion
  &&Number(input.runtime?.migrationVersion)===RELEASE.migrationVersion;
 const executionCertified=Boolean(execution?.certified);
 const promotionVerified=Boolean(promotion?.promoted&&!promotion?.rolledBack&&!promotion?.blockers?.length);
 const commitIdentityVerified=Boolean(
  deployedCommit
  &&execution?.commitSha===deployedCommit
  &&promotion?.commitSha===deployedCommit
 );
 if(!runtimeIdentityVerified)blockers.push('live runtime identity does not match the current release manifest');
 if(!executionCertified)blockers.push('current release execution certification is missing or not certified');
 if(!promotionVerified)blockers.push('current release promotion provenance is missing, rolled back, or blocked');
 if(!commitIdentityVerified)blockers.push('deployed commit does not match execution certification and promotion provenance');
 if(!/^https:\/\//.test(input.deploymentUrl))blockers.push('deployment URL is missing or invalid');
 if(!['vercel','cloudflare'].includes(input.platform))blockers.push('deployment platform is unsupported');

 return {
  certified:blockers.length===0,
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  deployedCommitSha:deployedCommit,
  promotionCommitSha:String(promotion?.commitSha||''),
  executionCommitSha:String(execution?.commitSha||''),
  deploymentUrl:input.deploymentUrl,
  platform:input.platform,
  source:input.source||'post-promotion-verification',
  workflowRunId:input.workflowRunId||null,
  provenanceId:promotion?.id||null,
  executionCertified,promotionVerified,runtimeIdentityVerified,commitIdentityVerified,
  blockers,evidence:{runtime:input.runtime||{},promotionCreatedAt:promotion?.createdAt||null,executionCreatedAt:execution?.createdAt||null}
 };
}

export async function savePostPromotionVerification(report:PostPromotionVerification){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into release_post_promotion_verifications(
   release_version,model_version,migration_version,deployed_commit_sha,promotion_commit_sha,
   execution_commit_sha,deployment_url,platform,source,workflow_run_id,provenance_id,
   execution_certified,promotion_verified,runtime_identity_verified,commit_identity_verified,
   certified,blockers,evidence
  ) values(
   ${report.releaseVersion},${report.modelVersion},${report.migrationVersion},${report.deployedCommitSha},
   ${report.promotionCommitSha},${report.executionCommitSha},${report.deploymentUrl},${report.platform},
   ${report.source},${report.workflowRunId},${report.provenanceId},${report.executionCertified},
   ${report.promotionVerified},${report.runtimeIdentityVerified},${report.commitIdentityVerified},
   ${report.certified},${sql.json(report.blockers)},${sql.json(report.evidence as any)}
  ) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

export async function latestPostPromotionVerification(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",deployed_commit_sha as "deployedCommitSha",
    promotion_commit_sha as "promotionCommitSha",execution_commit_sha as "executionCommitSha",
    deployment_url as "deploymentUrl",platform,source,workflow_run_id as "workflowRunId",
    provenance_id as "provenanceId",execution_certified as "executionCertified",
    promotion_verified as "promotionVerified",runtime_identity_verified as "runtimeIdentityVerified",
    commit_identity_verified as "commitIdentityVerified",certified,blockers,evidence,
    created_at as "createdAt"
   from release_post_promotion_verifications
   where release_version=${RELEASE.appVersion}
   order by created_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
