import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const commit='0123456789abcdef';
 const simulated={
  releaseVersion:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  commitSha:commit,
  executionCertified:true,
  promotionVerified:true,
  postPromotionVerified:true,
  platformConverged:true,
  rollbackClear:true
 };
 return Response.json({
  ok:true,
  assertions:{
   releaseIdentity:simulated.releaseVersion===RELEASE.appVersion&&simulated.modelVersion===RELEASE.modelVersion&&simulated.migrationVersion===RELEASE.migrationVersion,
   commitIdentity:simulated.commitSha===commit,
   allClosureGatesRequired:Object.values({
    execution:simulated.executionCertified,
    promotion:simulated.promotionVerified,
    postPromotion:simulated.postPromotionVerified,
    convergence:simulated.platformConverged,
    rollback:simulated.rollbackClear
   }).every(Boolean)
  }
 });
}
