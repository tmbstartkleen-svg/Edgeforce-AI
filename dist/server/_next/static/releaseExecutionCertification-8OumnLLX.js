import{t as e}from"./db-9LtqYd6N.js";import{t}from"./releaseManifest-bHjF1npa.js";function n(e){let n=[];e.releaseVersion!==t.appVersion&&n.push(`release version mismatch: ${e.releaseVersion} != ${t.appVersion}`),e.modelVersion!==t.modelVersion&&n.push(`model version mismatch: ${e.modelVersion} != ${t.modelVersion}`),Number(e.migrationVersion)!==t.migrationVersion&&n.push(`migration version mismatch: ${e.migrationVersion} != ${t.migrationVersion}`),(!e.commitSha||e.commitSha.length<7)&&n.push(`commit SHA is missing or invalid`);for(let[t,r]of[[`lintPassed`,`lint`],[`typecheckPassed`,`typecheck`],[`buildPassed`,`build`],[`migrationPassed`,`migration validation`],[`auditPassed`,`release audit`],[`smokePassed`,`local smoke`],[`loadPassed`,`load check`],[`mlCompilePassed`,`ML compile`],[`remoteSmokePassed`,`hosted smoke`]])e[t]!==!0&&n.push(`${r} did not pass`);return{certified:n.length===0,blockers:n,evidence:e}}async function r(t){let n=e();if(!n)return{persisted:!1,id:null};let r=t.evidence,[i]=await n`
  insert into release_execution_certifications(
   release_version,model_version,migration_version,commit_sha,source,
   lint_passed,typecheck_passed,build_passed,migration_passed,audit_passed,
   smoke_passed,load_passed,ml_compile_passed,remote_smoke_passed,
   certified,blockers,evidence
  ) values(
   ${r.releaseVersion},${r.modelVersion},${r.migrationVersion},${r.commitSha},${r.source},
   ${r.lintPassed},${r.typecheckPassed},${r.buildPassed},${r.migrationPassed},${r.auditPassed},
   ${r.smokePassed},${r.loadPassed},${r.mlCompilePassed},${r.remoteSmokePassed},
   ${t.certified},${n.json(t.blockers)},${n.json(r.evidence||{})}
  ) returning id
 `;return{persisted:!0,id:Number(i?.id||0)||null}}async function i(){let t=e();if(!t)return null;try{let[e]=await t`
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
  `;return e?{id:Number(e.id),releaseVersion:String(e.releaseVersion),modelVersion:String(e.modelVersion),migrationVersion:Number(e.migrationVersion),commitSha:String(e.commitSha),source:String(e.source),lintPassed:!!e.lintPassed,typecheckPassed:!!e.typecheckPassed,buildPassed:!!e.buildPassed,migrationPassed:!!e.migrationPassed,auditPassed:!!e.auditPassed,smokePassed:!!e.smokePassed,loadPassed:!!e.loadPassed,mlCompilePassed:!!e.mlCompilePassed,remoteSmokePassed:!!e.remoteSmokePassed,certified:!!e.certified,blockers:Array.isArray(e.blockers)?e.blockers.map(String):[],evidence:e.evidence&&typeof e.evidence==`object`?e.evidence:{},createdAt:new Date(e.createdAt).toISOString()}:null}catch{return null}}async function a(){let n=e();if(!n)return null;try{let[e]=await n`
   select id,release_version as "releaseVersion",model_version as "modelVersion",
    migration_version as "migrationVersion",commit_sha as "commitSha",source,
    lint_passed as "lintPassed",typecheck_passed as "typecheckPassed",
    build_passed as "buildPassed",migration_passed as "migrationPassed",
    audit_passed as "auditPassed",smoke_passed as "smokePassed",
    load_passed as "loadPassed",ml_compile_passed as "mlCompilePassed",
    remote_smoke_passed as "remoteSmokePassed",certified,blockers,evidence,
    created_at as "createdAt"
   from release_execution_certifications
   where release_version=${t.appVersion} and model_version=${t.modelVersion}
    and migration_version=${t.migrationVersion}
   order by created_at desc limit 1
  `;return e?{id:Number(e.id),releaseVersion:String(e.releaseVersion),modelVersion:String(e.modelVersion),migrationVersion:Number(e.migrationVersion),commitSha:String(e.commitSha),source:String(e.source),lintPassed:!!e.lintPassed,typecheckPassed:!!e.typecheckPassed,buildPassed:!!e.buildPassed,migrationPassed:!!e.migrationPassed,auditPassed:!!e.auditPassed,smokePassed:!!e.smokePassed,loadPassed:!!e.loadPassed,mlCompilePassed:!!e.mlCompilePassed,remoteSmokePassed:!!e.remoteSmokePassed,certified:!!e.certified,blockers:Array.isArray(e.blockers)?e.blockers.map(String):[],evidence:e.evidence&&typeof e.evidence==`object`?e.evidence:{},createdAt:new Date(e.createdAt).toISOString()}:null}catch{return null}}export{r as i,n,i as r,a as t};