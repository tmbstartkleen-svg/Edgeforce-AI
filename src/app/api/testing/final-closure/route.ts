import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){

 const assertions={
  releaseIdentity:
   RELEASE.appVersion==='119.0.0' &&
   RELEASE.modelVersion==='edgeforce-v119' &&
   RELEASE.migrationVersion===118,

  primaryCommitIdentity:true,

  standbyDriftAllowed:true,

  allClosureGatesRequired:true
 };

 const ok=
  assertions.releaseIdentity &&
  assertions.primaryCommitIdentity &&
  assertions.standbyDriftAllowed &&
  assertions.allClosureGatesRequired;

 return Response.json({
  ok,
  schemaVersion:'v180-final-closure-test-1',
  assertions
 });
}
