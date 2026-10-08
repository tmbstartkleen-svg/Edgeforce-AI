import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";function n(e){try{let t=new URL(String(e||``));return t.protocol===`https:`&&!!t.hostname}catch{return!1}}async function r(r){let i=[];[`vercel`,`cloudflare`].includes(String(r.platform))||i.push(`deployment platform is unsupported`),r.version!==t.appVersion&&i.push(`release version mismatch`),r.modelVersion!==t.modelVersion&&i.push(`model version mismatch`),Number(r.migrationVersion)!==t.migrationVersion&&i.push(`migration version mismatch`),(!r.commitSha||r.commitSha.length<7)&&i.push(`commit SHA missing or invalid`),n(r.deploymentUrl)||i.push(`deployment URL missing or invalid`);let a=r.topology===`cloudflare-primary-vercel-standby`;a&&r.platform!==`cloudflare`&&i.push(`Cloudflare must be the primary platform in primary-standby topology`),a&&r.exactMainCertified!==!0&&i.push(`exact-main certification did not pass`),a&&r.hostedSmokePassed!==!0&&i.push(`Cloudflare hosted smoke did not pass`),a&&r.platformReady!==!0&&i.push(`Cloudflare platform launch doctor did not pass`);let o=r.standby||null;a&&(o?(n(String(o.deploymentUrl||``))||i.push(`Vercel standby URL is missing or invalid`),o.healthy!==!0&&i.push(`Vercel standby health check failed`),o.manualOnly!==!0&&i.push(`Vercel standby is not configured as manual-only`),String(o.state||``).toUpperCase()!==`READY`&&i.push(`Vercel standby deployment is not READY`)):i.push(`Vercel standby evidence is missing`));let s=e();if(!s)return{certified:!1,blockers:[...i,`database unavailable`]};let[c]=await s`
   select * from release_platform_convergence
   where release_version=${t.appVersion}
     and commit_sha=${r.commitSha}
   limit 1
 `,l=a?{vercelUrl:o?.deploymentUrl||c?.vercel_url||null,cloudflareUrl:r.deploymentUrl,vercelVerified:!!(o?.healthy&&o?.manualOnly&&String(o?.state||``).toUpperCase()===`READY`),cloudflareVerified:i.filter(e=>!e.startsWith(`Vercel standby`)).length===0}:{vercelUrl:r.platform===`vercel`?r.deploymentUrl:c?.vercel_url||null,cloudflareUrl:r.platform===`cloudflare`?r.deploymentUrl:c?.cloudflare_url||null,vercelVerified:r.platform===`vercel`?i.length===0:!!c?.vercel_verified,cloudflareVerified:r.platform===`cloudflare`?i.length===0:!!c?.cloudflare_verified},u=l.vercelVerified&&l.cloudflareVerified,d=u,f=u,p=i.length===0&&u,m={topology:a?`cloudflare-primary-vercel-standby`:`dual-active`,topologyVersion:a?`v145-primary-standby-1`:`legacy-dual-active`,platform:r.platform,workflowRunId:r.workflowRunId||null,source:r.source||null,primary:{platform:r.platform,commitSha:r.commitSha,deploymentUrl:r.deploymentUrl,exactMainCertified:!!r.exactMainCertified,hostedSmokePassed:!!r.hostedSmokePassed,platformReady:!!r.platformReady},standby:o?{platform:`vercel`,deploymentUrl:o.deploymentUrl,deploymentId:o.deploymentId||null,commitSha:o.commitSha||null,state:o.state||null,healthy:o.healthy,manualOnly:o.manualOnly,healthStatus:o.healthStatus||null,commitDrift:!!(o.commitSha&&o.commitSha!==r.commitSha)}:null},[h]=await s`
  insert into release_platform_convergence(
   release_version,model_version,migration_version,commit_sha,
   vercel_url,cloudflare_url,vercel_verified,cloudflare_verified,
   commit_converged,runtime_converged,certified,blockers,evidence,updated_at
  ) values(
   ${t.appVersion},${t.modelVersion},${t.migrationVersion},${r.commitSha},
   ${l.vercelUrl},${l.cloudflareUrl},${l.vercelVerified},${l.cloudflareVerified},
   ${d},${f},${p},${s.json(i)},
   ${s.json(m)},now()
  )
  on conflict (release_version,commit_sha) do update set
   vercel_url=excluded.vercel_url,
   cloudflare_url=excluded.cloudflare_url,
   vercel_verified=excluded.vercel_verified,
   cloudflare_verified=excluded.cloudflare_verified,
   commit_converged=excluded.commit_converged,
   runtime_converged=excluded.runtime_converged,
   certified=excluded.certified,
   blockers=excluded.blockers,
   evidence=excluded.evidence,
   updated_at=now()
  returning *
 `;return h}async function i(){let n=e();if(!n)return null;try{let[e]=await n`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",
    vercel_url as "vercelUrl",cloudflare_url as "cloudflareUrl",
    vercel_verified as "vercelVerified",cloudflare_verified as "cloudflareVerified",
    commit_converged as "commitConverged",runtime_converged as "runtimeConverged",
    certified,blockers,evidence,created_at as "createdAt",updated_at as "updatedAt"
   from release_platform_convergence
   where release_version=${t.appVersion}
   order by updated_at desc limit 1
  `;return e||null}catch{return null}}export{r as n,i as t};