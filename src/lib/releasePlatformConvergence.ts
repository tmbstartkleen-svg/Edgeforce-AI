import {db} from './db';
import {RELEASE} from './releaseManifest';

export type PlatformEvidence={
 platform:'vercel'|'cloudflare';
 deploymentUrl:string;
 version:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 workflowRunId?:string|null;
 source?:string|null;
};

export async function recordPlatformEvidence(input:PlatformEvidence){
 const blockers:string[]=[];
 if(input.version!==RELEASE.appVersion)blockers.push('release version mismatch');
 if(input.modelVersion!==RELEASE.modelVersion)blockers.push('model version mismatch');
 if(Number(input.migrationVersion)!==RELEASE.migrationVersion)blockers.push('migration version mismatch');
 if(!input.commitSha||input.commitSha.length<7)blockers.push('commit SHA missing or invalid');
 if(!/^https:\/\//.test(input.deploymentUrl))blockers.push('deployment URL missing or invalid');

 const sql=db();
 if(!sql)return {certified:false,blockers:[...blockers,'database unavailable']};

 const [existing]=await sql`
   select * from release_platform_convergence
   where release_version=${RELEASE.appVersion}
     and commit_sha=${input.commitSha}
   limit 1
 `;

 const next={
  vercelUrl:input.platform==='vercel'?input.deploymentUrl:(existing?.vercel_url||null),
  cloudflareUrl:input.platform==='cloudflare'?input.deploymentUrl:(existing?.cloudflare_url||null),
  vercelVerified:input.platform==='vercel'?blockers.length===0:Boolean(existing?.vercel_verified),
  cloudflareVerified:input.platform==='cloudflare'?blockers.length===0:Boolean(existing?.cloudflare_verified),
 };

 const commitConverged=next.vercelVerified&&next.cloudflareVerified;
 const runtimeConverged=commitConverged;
 const certified=blockers.length===0&&commitConverged&&runtimeConverged;

 const [row]=await sql`
  insert into release_platform_convergence(
   release_version,model_version,migration_version,commit_sha,
   vercel_url,cloudflare_url,vercel_verified,cloudflare_verified,
   commit_converged,runtime_converged,certified,blockers,evidence,updated_at
  ) values(
   ${RELEASE.appVersion},${RELEASE.modelVersion},${RELEASE.migrationVersion},${input.commitSha},
   ${next.vercelUrl},${next.cloudflareUrl},${next.vercelVerified},${next.cloudflareVerified},
   ${commitConverged},${runtimeConverged},${certified},${sql.json(blockers)},
   ${sql.json({platform:input.platform,workflowRunId:input.workflowRunId||null,source:input.source||null} as any)},now()
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
   evidence=coalesce(release_platform_convergence.evidence,'{}'::jsonb)||excluded.evidence,
   updated_at=now()
  returning *
 `;
 return row;
}

export async function latestPlatformConvergence(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",
    vercel_url as "vercelUrl",cloudflare_url as "cloudflareUrl",
    vercel_verified as "vercelVerified",cloudflare_verified as "cloudflareVerified",
    commit_converged as "commitConverged",runtime_converged as "runtimeConverged",
    certified,blockers,evidence,created_at as "createdAt",updated_at as "updatedAt"
   from release_platform_convergence
   where release_version=${RELEASE.appVersion}
   order by updated_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
