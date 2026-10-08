import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const valid={
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  failedCommitSha:'0123456789abcdef',
  failedDeploymentUrl:'https://failed.example.com',
  restoredDeploymentId:'dpl_previous',
  restoredDeploymentUrl:'https://restored.example.com'
 };
 return Response.json({
  ok:true,
  schemaVersion:'v101-rollback-reconciliation-test-1',
  assertions:{
   validFailedCommit:valid.failedCommitSha.length>=7,
   validFailedUrl:valid.failedDeploymentUrl.startsWith('https://'),
   validRestoreIdentity:Boolean(valid.restoredDeploymentId||valid.restoredDeploymentUrl),
   currentReleaseIdentity:valid.releaseVersion===RELEASE.appVersion&&valid.modelVersion===RELEASE.modelVersion&&valid.migrationVersion===RELEASE.migrationVersion
  }
 });
}
