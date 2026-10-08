import {evaluateReleasePromotionEvidence} from '@/lib/releasePromotionProvenance';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const base={
  releaseVersion:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion,
  commitSha:'0123456789abcdef',platform:'vercel',deploymentUrl:'https://edgeforce.example.com',deploymentId:'dpl_test',
  source:'regression',workflowRunId:'123',workflowRunAttempt:'1',
  executionCertified:true,strictCertified:true,canaryPassed:true,v1Ready:true,promoted:true,rolledBack:false,evidence:{}
 };
 const pass=evaluateReleasePromotionEvidence(base);
 const fail=evaluateReleasePromotionEvidence({...base,commitSha:'bad',canaryPassed:false});
 return Response.json({
  ok:pass.certified&&!fail.certified&&fail.blockers.length===2,
  schemaVersion:'v99-release-promotion-provenance-test-1',
  pass,fail
 });
}
