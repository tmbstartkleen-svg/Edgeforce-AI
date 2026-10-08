import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./releaseExecutionCertification-8OumnLLX.js";import{t as r}from"./releasePromotionProvenance-B5TkkTVj.js";async function i(e){let[i,a]=await Promise.all([n(),r()]),o=String(e.runtime?.commitSha||process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||``),s=[],c=e.runtime?.version===t.appVersion&&e.runtime?.modelVersion===t.modelVersion&&Number(e.runtime?.migrationVersion)===t.migrationVersion,l=!!i?.certified,u=!!(a?.promoted&&!a?.rolledBack&&!a?.blockers?.length),d=!!(o&&i?.commitSha===o&&a?.commitSha===o);return c||s.push(`live runtime identity does not match the current release manifest`),l||s.push(`current release execution certification is missing or not certified`),u||s.push(`current release promotion provenance is missing, rolled back, or blocked`),d||s.push(`deployed commit does not match execution certification and promotion provenance`),/^https:\/\//.test(e.deploymentUrl)||s.push(`deployment URL is missing or invalid`),[`vercel`,`cloudflare`].includes(e.platform)||s.push(`deployment platform is unsupported`),{certified:s.length===0,releaseVersion:t.appVersion,modelVersion:t.modelVersion,migrationVersion:t.migrationVersion,deployedCommitSha:o,promotionCommitSha:String(a?.commitSha||``),executionCommitSha:String(i?.commitSha||``),deploymentUrl:e.deploymentUrl,platform:e.platform,source:e.source||`post-promotion-verification`,workflowRunId:e.workflowRunId||null,provenanceId:a?.id||null,executionCertified:l,promotionVerified:u,runtimeIdentityVerified:c,commitIdentityVerified:d,blockers:s,evidence:{runtime:e.runtime||{},promotionCreatedAt:a?.createdAt||null,executionCreatedAt:i?.createdAt||null}}}async function a(t){let n=e();if(!n)return{persisted:!1,id:null};let[r]=await n`
  insert into release_post_promotion_verifications(
   release_version,model_version,migration_version,deployed_commit_sha,promotion_commit_sha,
   execution_commit_sha,deployment_url,platform,source,workflow_run_id,provenance_id,
   execution_certified,promotion_verified,runtime_identity_verified,commit_identity_verified,
   certified,blockers,evidence
  ) values(
   ${t.releaseVersion},${t.modelVersion},${t.migrationVersion},${t.deployedCommitSha},
   ${t.promotionCommitSha},${t.executionCommitSha},${t.deploymentUrl},${t.platform},
   ${t.source},${t.workflowRunId},${t.provenanceId},${t.executionCertified},
   ${t.promotionVerified},${t.runtimeIdentityVerified},${t.commitIdentityVerified},
   ${t.certified},${n.json(t.blockers)},${n.json(t.evidence)}
  ) returning id
 `;return{persisted:!0,id:Number(r?.id||0)||null}}async function o(){let n=e();if(!n)return null;try{let[e]=await n`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",deployed_commit_sha as "deployedCommitSha",
    promotion_commit_sha as "promotionCommitSha",execution_commit_sha as "executionCommitSha",
    deployment_url as "deploymentUrl",platform,source,workflow_run_id as "workflowRunId",
    provenance_id as "provenanceId",execution_certified as "executionCertified",
    promotion_verified as "promotionVerified",runtime_identity_verified as "runtimeIdentityVerified",
    commit_identity_verified as "commitIdentityVerified",certified,blockers,evidence,
    created_at as "createdAt"
   from release_post_promotion_verifications
   where release_version=${t.appVersion}
   order by created_at desc limit 1
  `;return e||null}catch{return null}}export{o as n,a as r,i as t};