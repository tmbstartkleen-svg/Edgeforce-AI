import {evaluateReleaseExecutionCertification} from '@/lib/releaseExecutionCertification';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const base={
  releaseVersion:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion,
  commitSha:'0123456789abcdef',source:'regression',
  lintPassed:true,typecheckPassed:true,buildPassed:true,migrationPassed:true,auditPassed:true,
  smokePassed:true,loadPassed:true,mlCompilePassed:true,remoteSmokePassed:true,evidence:{}
 };
 const pass=evaluateReleaseExecutionCertification(base);
 const fail=evaluateReleaseExecutionCertification({...base,typecheckPassed:false,remoteSmokePassed:false});
 return Response.json({
  ok:pass.certified&&!fail.certified&&fail.blockers.length===2,
  schemaVersion:'v97-release-execution-certification-test-1',
  pass,fail
 });
}
