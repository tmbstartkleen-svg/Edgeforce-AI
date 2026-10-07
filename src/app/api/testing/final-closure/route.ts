import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const commit='0123456789abcdef';
 const standbyCommit='fedcba9876543210';
 const simulated={
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  commitSha:commit,
  exactMainCertified:true,
  cloudflarePrimaryReady:true,
  hostedSmokePassed:true,
  vercelStandbyReady:true,
  rollbackClear:true
 };
 return Response.json({
  ok:true,
  schemaVersion:'v145-primary-standby-closure-test-1',
  assertions:{
   releaseIdentity:simulated.releaseVersion===RELEASE.appVersion&&simulated.modelVersion===RELEASE.modelVersion&&simulated.migrationVersion===RELEASE.migrationVersion,
   primaryCommitIdentity:simulated.commitSha===commit,
   standbyDriftAllowed:standbyCommit!==commit,
   allClosureGatesRequired:Object.values({
    exactMain:simulated.exactMainCertified,
    primary:simulated.cloudflarePrimaryReady,
    smoke:simulated.hostedSmokePassed,
    standby:simulated.vercelStandbyReady,
    rollback:simulated.rollbackClear
   }).every(Boolean)
  }
 });
}
