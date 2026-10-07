import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const primary={
  platform:'cloudflare',
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  commitSha:'0123456789abcdef',
  exactMainCertified:true,
  hostedSmokePassed:true,
  platformReady:true
 };
 const standby={
  platform:'vercel',
  commitSha:'fedcba9876543210',
  state:'READY',
  healthy:true,
  manualOnly:true
 };
 return Response.json({
  ok:true,
  schemaVersion:'v145-primary-standby-test-1',
  assertions:{
   primaryReleaseIdentity:primary.version===RELEASE.appVersion&&primary.modelVersion===RELEASE.modelVersion&&primary.migrationVersion===RELEASE.migrationVersion,
   primaryCertified:primary.exactMainCertified&&primary.hostedSmokePassed&&primary.platformReady,
   standbyReady:standby.state==='READY'&&standby.healthy&&standby.manualOnly,
   standbyCommitDriftAllowed:standby.commitSha!==primary.commitSha
  }
 });
}
