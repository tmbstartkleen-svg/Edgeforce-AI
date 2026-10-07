import {db} from './db';
import {RELEASE} from './releaseManifest';

export type StandbyEvidence={
 deploymentUrl:string;
 deploymentId?:string|null;
 commitSha?:string|null;
 state?:string|null;
 healthy:boolean;
 manualOnly:boolean;
 healthStatus?:number|null;
};

export type PlatformEvidence={
 platform:'vercel'|'cloudflare';
 deploymentUrl:string;
 version:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 workflowRunId?:string|null;
 source?:string|null;
 topology?:'dual-active'|'cloudflare-primary-vercel-standby';
 standby?:StandbyEvidence|null;
 exactMainCertified?:boolean;
 hostedSmokePassed?:boolean;
 platformReady?:boolean;
};

function validUrl(value:string){return /^https:\/\/\//.test(value)}

export async function recordPlatformEvidence(input:PlatformEvidence){
 const blockers:string[]=[];
 if(!['vercel','cloudflare'].includes(String(input.platform)))blockers.push('deployment platform is unsupported');
 if(input.version!==RELEASE.appVersion)blockers.push('release version mismatch');
 if(input.modelVersion!==RELEASE.modelVersion)blockers.push('model version mismatch');
 if(Number(input.migrationVersion)!==RELEASE.migrationVersion)blockers.push('migration version mismatch');
 if(!input.commitSha||input.commitSha.length<7)blockers.push('commit SHA missing or invalid');
 if(!validUrl(input.deploymentUrl))blockers.push('deployment URL missing or invalid');

 const primaryStandby=input.topology==='cloudflare-primary-vercel-standby';
 if(primaryStandby&&input.platform!=='cloudflare')blockers.push('Cloudflare must be the primary platform in primary-standby topology');
 if(primaryStandby&&input.exactMainCertified!==true)blockers.push('exact-main certification did not pass');
 if(primaryStandby&&input.hostedSmokePassed!==true)blockers.push('Cloudflare hosted smoke did not pass');
 if(primaryStandby&&input.platformReady!==true)blockers.push('Cloudflare platform launch doctor did not pass');

 const standby=input.standby||null;
 if(primaryStandby){
  if(!standby)blockers.push('Vercel standby evidence is missing');
  else{
   if(!validUrl(String(standby.deploymentUrl||'')))blockers.push('Vercel standby URL is missing or invalid');
   if(standby.healthy!==true)blockers.push('Vercel standby health check failed');
   if(standby.manualOnly!==true)blockers.push('Vercel standby is not configured as manual-only');
   if(String(standby.state||'').toUpperCase()!=='READY')blockers.push('Vercel standby deployment is not READY');
  }
 }

 const sql=db();
 if(!sql)return {certified:false,blockers:[...blockers,'database unavailable']};

 const [existing]=await sql`
   select * from release_platform_convergence
   where release_version=${RELEASE.appVersion}
     and commit_sha=${input.commitSha}
   limit 1
 `;

 const next=primaryStandby?{
  vercelUrl:standby?.deploymentUrl||existing?.vercel_url||null,
  cloudflareUrl:input.deploymentUrl,
  vercelVerified:Boolean(standby?.healthy&&standby?.manualOnly&&String(standby?.state||'').toUpperCase()==='READY'),
  cloudflareVerified:blockers.filter(x=>!x.startsWith('Vercel standby')).length===0
 }:{
  vercelUrl:input.platform==='vercel'?input.deploymentUrl:(existing?.vercel_url||null),
  cloudflareUrl:input.platform==='cloudflare'?input.deploymentUrl:(existing?.cloudflare_url||null),
  vercelVerified:input.platform==='vercel'?blockers.length===0:Boolean(existing?.vercel_verified),
  cloudflareVerified:input.platform==='cloudflare'?blockers.length===0:Boolean(existing?.cloudflare_verified)
 };

 const topologyReady=next.vercelVerified&&next.cloudflareVerified;
 const commitConverged=topologyReady;
 const runtimeConverged=topologyReady;
 const certified=blockers.length===0&&topologyReady;
 const evidence={
  topology:primaryStandby?'cloudflare-primary-vercel-standby':'dual-active',
  topologyVersion:primaryStandby?'v145-primary-standby-1':'legacy-dual-active',
  platform:input.platform,
  workflowRunId:input.workflowRunId||null,
  source:input.source||null,
  primary:{
   platform:input.platform,
   commitSha:input.commitSha,
   deploymentUrl:input.deploymentUrl,
   exactMainCertified:Boolean(input.exactMainCertified),
   hostedSmokePassed:Boolean(input.hostedSmokePassed),
   platformReady:Boolean(input.platformReady)
  },
  standby:standby?{
   platform:'vercel',
   deploymentUrl:standby.deploymentUrl,
   deploymentId:standby.deploymentId||null,
   commitSha:standby.commitSha||null,
   state:standby.state||null,
   healthy:standby.healthy,
   manualOnly:standby.manualOnly,
   healthStatus:standby.healthStatus||null,
   commitDrift:Boolean(standby.commitSha&&standby.commitSha!==input.commitSha)
  }:null
 };

 const [row]=await sql`
  insert into release_platform_convergence(
   release_version,model_version,migration_version,commit_sha,
   vercel_url,cloudflare_url,vercel_verified,cloudflare_verified,
   commit_converged,runtime_converged,certified,blockers,evidence,updated_at
  ) values(
   ${RELEASE.appVersion},${RELEASE.modelVersion},${RELEASE.migrationVersion},${input.commitSha},
   ${next.vercelUrl},${next.cloudflareUrl},${next.vercelVerified},${next.cloudflareVerified},
   ${commitConverged},${runtimeConverged},${certified},${sql.json(blockers)},
   ${sql.json(evidence as any)},now()
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
