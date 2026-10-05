import {db} from './db';
import {RELEASE} from './releaseManifest';

export type ReleaseExecutionEvidence={
 releaseVersion:string;
 modelVersion:string;
 migrationVersion:number;
 commitSha:string;
 source:string;
 lintPassed:boolean;
 typecheckPassed:boolean;
 buildPassed:boolean;
 migrationPassed:boolean;
 auditPassed:boolean;
 smokePassed:boolean;
 loadPassed:boolean;
 mlCompilePassed:boolean;
 remoteSmokePassed:boolean;
 evidence?:Record<string,unknown>;
};

export type ReleaseExecutionCertification={
 certified:boolean;
 blockers:string[];
 evidence:ReleaseExecutionEvidence;
};

export function evaluateReleaseExecutionCertification(input:ReleaseExecutionEvidence):ReleaseExecutionCertification{
 const blockers:string[]=[];
 if(input.releaseVersion!==RELEASE.appVersion)blockers.push(`release version mismatch: ${input.releaseVersion} != ${RELEASE.appVersion}`);
 if(input.modelVersion!==RELEASE.modelVersion)blockers.push(`model version mismatch: ${input.modelVersion} != ${RELEASE.modelVersion}`);
 if(Number(input.migrationVersion)!==RELEASE.migrationVersion)blockers.push(`migration version mismatch: ${input.migrationVersion} != ${RELEASE.migrationVersion}`);
 if(!input.commitSha||input.commitSha.length<7)blockers.push('commit SHA is missing or invalid');

 const gates:Array<[keyof ReleaseExecutionEvidence,string]>= [
  ['lintPassed','lint'],
  ['typecheckPassed','typecheck'],
  ['buildPassed','build'],
  ['migrationPassed','migration validation'],
  ['auditPassed','release audit'],
  ['smokePassed','local smoke'],
  ['loadPassed','load check'],
  ['mlCompilePassed','ML compile'],
  ['remoteSmokePassed','hosted smoke']
 ];
 for(const [key,label] of gates)if(input[key]!==true)blockers.push(`${label} did not pass`);

 return {certified:blockers.length===0,blockers,evidence:input};
}

export async function saveReleaseExecutionCertification(report:ReleaseExecutionCertification){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const e=report.evidence;
 const [row]=await sql`
  insert into release_execution_certifications(
   release_version,model_version,migration_version,commit_sha,source,
   lint_passed,typecheck_passed,build_passed,migration_passed,audit_passed,
   smoke_passed,load_passed,ml_compile_passed,remote_smoke_passed,
   certified,blockers,evidence
  ) values(
   ${e.releaseVersion},${e.modelVersion},${e.migrationVersion},${e.commitSha},${e.source},
   ${e.lintPassed},${e.typecheckPassed},${e.buildPassed},${e.migrationPassed},${e.auditPassed},
   ${e.smokePassed},${e.loadPassed},${e.mlCompilePassed},${e.remoteSmokePassed},
   ${report.certified},${sql.json(report.blockers)},${sql.json((e.evidence||{}) as any)}
  ) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

export async function latestReleaseExecutionCertification(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",source,
    lint_passed as "lintPassed",typecheck_passed as "typecheckPassed",
    build_passed as "buildPassed",migration_passed as "migrationPassed",
    audit_passed as "auditPassed",smoke_passed as "smokePassed",
    load_passed as "loadPassed",ml_compile_passed as "mlCompilePassed",
    remote_smoke_passed as "remoteSmokePassed",certified,blockers,evidence,
    created_at as "createdAt"
   from release_execution_certifications
   order by created_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}

export async function currentReleaseExecutionCertification(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",source,
    lint_passed as "lintPassed",typecheck_passed as "typecheckPassed",
    build_passed as "buildPassed",migration_passed as "migrationPassed",
    audit_passed as "auditPassed",smoke_passed as "smokePassed",
    load_passed as "loadPassed",ml_compile_passed as "mlCompilePassed",
    remote_smoke_passed as "remoteSmokePassed",certified,blockers,evidence,
    created_at as "createdAt"
   from release_execution_certifications
   where release_version=${RELEASE.appVersion} and model_version=${RELEASE.modelVersion}
    and migration_version=${RELEASE.migrationVersion}
   order by created_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
