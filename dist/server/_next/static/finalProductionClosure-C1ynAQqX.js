import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";import{t as n}from"./releasePlatformConvergence-BLqWGuJI.js";import{t as r}from"./releaseExecutionCertification-8OumnLLX.js";import{t as i}from"./releasePromotionProvenance-B5TkkTVj.js";import{n as a}from"./postPromotionVerification-Dxuaa0fD.js";import{t as o}from"./releaseRollbackReconciliation-hxsTv_7A.js";async function s(e){let[s,c,l,u,d]=await Promise.all([r(),i(),a(),n(),o()]),f=String(e.commitSha||``),p=[],m=u?.evidence&&typeof u.evidence==`object`?u.evidence:{},h=m?.topology===`cloudflare-primary-vercel-standby`,g=m?.primary||{},_=m?.standby||{},v=!!(s?.certified&&String(s?.commitSha||``)===f),y=!!(c?.promoted&&!c?.rolledBack&&!c?.blockers?.length&&String(c?.commitSha||``)===f),b=!!(l?.certified&&String(l?.deployedCommitSha||``)===f),x=h?!!(g.exactMainCertified&&String(u?.commitSha||``)===f):v,S=h?!!(u?.cloudflareVerified&&g.platform===`cloudflare`&&g.platformReady&&String(g.commitSha||``)===f):y,C=h?!!(u?.cloudflareVerified&&g.hostedSmokePassed&&String(g.commitSha||``)===f):b,w=h?!!(u?.certified&&String(u?.commitSha||``)===f&&u?.cloudflareVerified&&u?.vercelVerified&&_.healthy===!0&&_.manualOnly===!0&&String(_.state||``).toUpperCase()===`READY`):!!(u?.certified&&String(u?.commitSha||``)===f&&u?.vercelVerified&&u?.cloudflareVerified),T=!(d?.rollbackConfirmed&&String(d?.failedCommitSha||``)===f);return(!f||f.length<7)&&p.push(`release commit SHA is missing or invalid`),x||p.push(h?`exact-main production certification is missing or failed`:`execution certification is missing, failed, or belongs to a different commit`),S||p.push(h?`Cloudflare primary deployment identity or platform readiness is not verified`:`production promotion provenance is missing, rolled back, blocked, or belongs to a different commit`),C||p.push(h?`Cloudflare primary hosted smoke verification is missing or failed`:`post-promotion live verification is missing, failed, or belongs to a different commit`),w||p.push(h?`Cloudflare primary and Vercel manual standby topology is not ready`:`Vercel and Cloudflare are not converged on the same production commit`),T||p.push(`the candidate production commit has a confirmed rollback`),{releaseVersion:t.appVersion,modelVersion:t.modelVersion,migrationVersion:t.migrationVersion,commitSha:f,executionCertified:x,promotionVerified:S,postPromotionVerified:C,platformConverged:w,rollbackClear:T,closed:p.length===0,blockers:p,evidence:{topology:h?`cloudflare-primary-vercel-standby`:`dual-active`,primaryCommitSha:g?.commitSha||null,standbyCommitSha:_?.commitSha||null,standbyCommitDrift:!!(_?.commitSha&&_?.commitSha!==f),standbyDeploymentId:_?.deploymentId||null,executionId:s?.id||null,promotionId:c?.id||null,postPromotionId:l?.id||null,convergenceId:u?.id||null,rollbackId:d?.id||null,evaluatedAt:new Date().toISOString()},source:e.source||`final-production-closure`,workflowRunId:e.workflowRunId||null}}async function c(t){let n=e();if(!n)return{persisted:!1,id:null};let[r]=await n`
  insert into release_final_closures(
   release_version,model_version,migration_version,commit_sha,
   execution_certified,promotion_verified,post_promotion_verified,platform_converged,
   rollback_clear,closed,blockers,evidence,source,workflow_run_id
  ) values(
   ${t.releaseVersion},${t.modelVersion},${t.migrationVersion},${t.commitSha},
   ${t.executionCertified},${t.promotionVerified},${t.postPromotionVerified},${t.platformConverged},
   ${t.rollbackClear},${t.closed},${n.json(t.blockers)},${n.json(t.evidence)},
   ${t.source},${t.workflowRunId}
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
 `;return{persisted:!0,id:Number(r?.id||0)||null}}async function l(){let n=e();if(!n)return null;try{let[e]=await n`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",
    execution_certified as "executionCertified",promotion_verified as "promotionVerified",
    post_promotion_verified as "postPromotionVerified",platform_converged as "platformConverged",
    rollback_clear as "rollbackClear",closed,blockers,evidence,source,
    workflow_run_id as "workflowRunId",created_at as "createdAt"
   from release_final_closures
   where release_version=${t.appVersion}
   order by created_at desc limit 1
  `;return e||null}catch{return null}}export{l as n,c as r,s as t};