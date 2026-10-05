import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const sample={
  modelVersion:RELEASE.modelVersion,
  serviceVersion:'edgeforce-ml-service-v61',
  deploymentStatus:'ACTIVE',
  healthOk:true,
  predictionHandshakeOk:true,
  activationState:'ACTIVE',
  championsActive:2,
  gitCommit:'abcdef123456',
  provider:'render'
 };
 const assertions={
  releaseIdentity:sample.modelVersion===RELEASE.modelVersion,
  serviceIdentity:sample.serviceVersion==='edgeforce-ml-service-v61',
  activeRequiresHealth:sample.activationState!=='ACTIVE'||sample.healthOk,
  activeRequiresHandshake:sample.activationState!=='ACTIVE'||sample.predictionHandshakeOk,
  activeRequiresChampion:sample.activationState!=='ACTIVE'||sample.championsActive>0,
  renderTrace:Boolean(sample.provider==='render'&&sample.gitCommit)
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V61',assertions,sample},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
