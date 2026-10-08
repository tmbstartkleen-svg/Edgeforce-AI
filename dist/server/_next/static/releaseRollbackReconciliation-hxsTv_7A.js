import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";async function n(n){let r=e(),i=[];(!n.failedCommitSha||n.failedCommitSha.length<7)&&i.push(`failed commit SHA is missing or invalid`),/^https:\/\//.test(n.failedDeploymentUrl)||i.push(`failed deployment URL is missing or invalid`),n.restoredDeploymentUrl&&!/^https:\/\//.test(n.restoredDeploymentUrl)&&i.push(`restored deployment URL is invalid`),[`vercel`,`cloudflare`].includes(n.platform)||i.push(`deployment platform is unsupported`);let a=!1,o=!1;if(r&&i.length===0){try{a=(await r`
    update release_promotion_provenance
    set rolled_back=true,
        blockers=case
          when blockers @> '["release was rolled back"]'::jsonb then blockers
          else blockers || '["release was rolled back"]'::jsonb
        end,
        evidence=coalesce(evidence,'{}'::jsonb) || ${r.json({rollbackReconciled:!0,restoredDeploymentId:n.restoredDeploymentId||null,restoredDeploymentUrl:n.restoredDeploymentUrl||null})}
    where release_version=${t.appVersion}
      and model_version=${t.modelVersion}
      and migration_version=${t.migrationVersion}
      and commit_sha=${n.failedCommitSha}
    returning id
   `).length>0}catch{}try{o=(await r`
    update release_post_promotion_verifications
    set certified=false,
        blockers=case
          when blockers @> '["deployment rolled back"]'::jsonb then blockers
          else blockers || '["deployment rolled back"]'::jsonb
        end,
        evidence=coalesce(evidence,'{}'::jsonb) || ${r.json({rollbackReconciled:!0,restoredDeploymentId:n.restoredDeploymentId||null,restoredDeploymentUrl:n.restoredDeploymentUrl||null})}
    where release_version=${t.appVersion}
      and model_version=${t.modelVersion}
      and migration_version=${t.migrationVersion}
      and deployed_commit_sha=${n.failedCommitSha}
    returning id
   `).length>0}catch{}}let s=i.length===0&&!!(n.restoredDeploymentId||n.restoredDeploymentUrl);s||i.push(`restored production deployment identity was not recorded`);let c={releaseVersion:t.appVersion,modelVersion:t.modelVersion,migrationVersion:t.migrationVersion,failedCommitSha:n.failedCommitSha,failedDeploymentUrl:n.failedDeploymentUrl,restoredDeploymentId:n.restoredDeploymentId||null,restoredDeploymentUrl:n.restoredDeploymentUrl||null,platform:n.platform,source:n.source,workflowRunId:n.workflowRunId||null,workflowRunAttempt:n.workflowRunAttempt||null,launchId:n.launchId||null,promotionReconciled:a,verificationInvalidated:o,rollbackConfirmed:s,blockers:i,evidence:{reconciledAt:new Date().toISOString()}};if(r)try{await r`
    insert into release_rollback_reconciliations(
      release_version,model_version,migration_version,failed_commit_sha,failed_deployment_url,
      restored_deployment_id,restored_deployment_url,platform,source,workflow_run_id,
      workflow_run_attempt,launch_id,promotion_reconciled,verification_invalidated,
      rollback_confirmed,blockers,evidence
    ) values(
      ${c.releaseVersion},${c.modelVersion},${c.migrationVersion},${c.failedCommitSha},
      ${c.failedDeploymentUrl},${c.restoredDeploymentId},${c.restoredDeploymentUrl},
      ${c.platform},${c.source},${c.workflowRunId},${c.workflowRunAttempt},${c.launchId},
      ${c.promotionReconciled},${c.verificationInvalidated},${c.rollbackConfirmed},
      ${r.json(c.blockers)},${r.json(c.evidence)}
    )
   `}catch{}return c}async function r(){let n=e();if(!n)return null;try{let[e]=await n`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",failed_commit_sha as "failedCommitSha",
    failed_deployment_url as "failedDeploymentUrl",restored_deployment_id as "restoredDeploymentId",
    restored_deployment_url as "restoredDeploymentUrl",platform,source,
    workflow_run_id as "workflowRunId",workflow_run_attempt as "workflowRunAttempt",
    launch_id as "launchId",promotion_reconciled as "promotionReconciled",
    verification_invalidated as "verificationInvalidated",rollback_confirmed as "rollbackConfirmed",
    blockers,evidence,created_at as "createdAt"
   from release_rollback_reconciliations
   where release_version=${t.appVersion}
   order by created_at desc limit 1
  `;return e||null}catch{return null}}export{n,r as t};