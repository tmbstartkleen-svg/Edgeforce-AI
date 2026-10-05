import {db} from './db';
import {RELEASE} from './releaseManifest';

export type ReleasePromotionEvidence={
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 platform:string;
 deploymentUrl:string;
 deploymentId?:string|null;
 source:string;
 workflowRunId?:string|null;
 workflowRunAttempt?:string|null;
 executionCertified:boolean;
 strictCertified:boolean;
 canaryPassed:boolean;
 v1Ready:boolean;
 promoted:boolean;
 rolledBack?:boolean;
 evidence?:Record<string,unknown>;
};

export type ReleasePromotionProvenance=ReleasePromotionEvidence&{
 id:number;
 blockers:string[];
 createdAt:string;
};

export function evaluateReleasePromotionEvidence(input:ReleasePromotionEvidence){
 const blockers:string[]=[];
 if(input.releaseVersion!==RELEASE.appVersion)blockers.push(`release version mismatch: ${input.releaseVersion} != ${RELEASE.appVersion}`);
 if(input.modelVersion!==RELEASE.modelVersion)blockers.push(`model version mismatch: ${input.modelVersion} != ${RELEASE.modelVersion}`);
 if(Number(input.migrationVersion)!==RELEASE.migrationVersion)blockers.push(`migration version mismatch: ${input.migrationVersion} != ${RELEASE.migrationVersion}`);
 if(!input.commitSha||input.commitSha.length<7)blockers.push('commit SHA is missing or invalid');
 if(!['vercel','cloudflare'].includes(input.platform))blockers.push('deployment platform is unsupported');
 if(!/^https:\/\//.test(input.deploymentUrl))blockers.push('deployment URL is missing or invalid');
 if(!input.executionCertified)blockers.push('release execution certification did not pass');
 if(!input.strictCertified)blockers.push('strict production certification did not pass');
 if(!input.canaryPassed)blockers.push('comparative canary did not pass');
 if(!input.v1Ready)blockers.push('strict V1 readiness did not pass');
 if(!input.promoted)blockers.push('release was not promoted');
 if(input.rolledBack)blockers.push('release was rolled back');
 return {certified:blockers.length===0,blockers,evidence:input};
}

export async function saveReleasePromotionProvenance(report:ReturnType<typeof evaluateReleasePromotionEvidence>){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const e=report.evidence;
 const [row]=await sql`
  insert into release_promotion_provenance(
   release_version,model_version,migration_version,commit_sha,platform,deployment_url,deployment_id,
   source,workflow_run_id,workflow_run_attempt,execution_certified,strict_certified,canary_passed,
   v1_ready,promoted,rolled_back,blockers,evidence
  ) values(
   ${e.releaseVersion},${e.modelVersion},${e.migrationVersion},${e.commitSha},${e.platform},${e.deploymentUrl},${e.deploymentId||null},
   ${e.source},${e.workflowRunId||null},${e.workflowRunAttempt||null},${e.executionCertified},${e.strictCertified},${e.canaryPassed},
   ${e.v1Ready},${e.promoted},${Boolean(e.rolledBack)},${sql.json(report.blockers)},${sql.json((e.evidence||{}) as any)}
  ) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

function mapRow(row:any):ReleasePromotionProvenance|null{
 if(!row)return null;
 return {
  id:Number(row.id),
  releaseVersion:String(row.releaseVersion),
  modelVersion:String(row.modelVersion),
  migrationVersion:Number(row.migrationVersion),
  commitSha:String(row.commitSha),
  platform:String(row.platform),
  deploymentUrl:String(row.deploymentUrl),
  deploymentId:row.deploymentId?String(row.deploymentId):null,
  source:String(row.source),
  workflowRunId:row.workflowRunId?String(row.workflowRunId):null,
  workflowRunAttempt:row.workflowRunAttempt?String(row.workflowRunAttempt):null,
  executionCertified:Boolean(row.executionCertified),
  strictCertified:Boolean(row.strictCertified),
  canaryPassed:Boolean(row.canaryPassed),
  v1Ready:Boolean(row.v1Ready),
  promoted:Boolean(row.promoted),
  rolledBack:Boolean(row.rolledBack),
  blockers:Array.isArray(row.blockers)?row.blockers.map(String):[],
  evidence:row.evidence&&typeof row.evidence==='object'?row.evidence:{},
  createdAt:new Date(row.createdAt).toISOString()
 };
}

const selectSql=(sql:any)=>sql`
 select id,release_version as "releaseVersion",model_version as "modelVersion",
  migration_version as "migrationVersion",commit_sha as "commitSha",platform,
  deployment_url as "deploymentUrl",deployment_id as "deploymentId",source,
  workflow_run_id as "workflowRunId",workflow_run_attempt as "workflowRunAttempt",
  execution_certified as "executionCertified",strict_certified as "strictCertified",
  canary_passed as "canaryPassed",v1_ready as "v1Ready",promoted,
  rolled_back as "rolledBack",blockers,evidence,created_at as "createdAt"
 from release_promotion_provenance
`;

export async function latestReleasePromotionProvenance():Promise<ReleasePromotionProvenance|null>{
 const sql=db();if(!sql)return null;
 try{
  const rows=await selectSql(sql);
  rows.sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  return mapRow(rows[0]);
 }catch{return null}
}

export async function currentReleasePromotionProvenance():Promise<ReleasePromotionProvenance|null>{
 const sql=db();if(!sql)return null;
 try{
  const rows=await selectSql(sql);
  const row=rows
   .filter((x:any)=>String(x.releaseVersion)===RELEASE.appVersion&&String(x.modelVersion)===RELEASE.modelVersion&&Number(x.migrationVersion)===RELEASE.migrationVersion)
   .sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())[0];
  return mapRow(row);
 }catch{return null}
}
