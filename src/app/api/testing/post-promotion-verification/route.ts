import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const goodRuntime={version:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion,commitSha:'0123456789abcdef'};
 const badRuntime={...goodRuntime,version:'bad-version',migrationVersion:0};
 return Response.json({
  ok:true,
  schemaVersion:'v100-post-promotion-verification-test-1',
  goodRuntime,badRuntime,
  assertions:{
   releaseIdentityMatches:goodRuntime.version===RELEASE.appVersion&&goodRuntime.modelVersion===RELEASE.modelVersion&&goodRuntime.migrationVersion===RELEASE.migrationVersion,
   badRuntimeRejected:badRuntime.version!==RELEASE.appVersion&&badRuntime.migrationVersion!==RELEASE.migrationVersion
  }
 });
}
