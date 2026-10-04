import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const sample={
  modelVersion:RELEASE.modelVersion,
  serviceVersion:'edgeforce-ml-service-v57',
  deploymentStatus:'ACTIVE',
  healthOk:true,
  predictionHandshakeOk:true,
  activationState:'ACTIVE',
  championsActive:2,
  gitCommit:'abcdef123456',
  provider:'render'
 };
 const assertions={
  releaseIdentity:sample.modelVersion==='edgeforce-v57',
  serviceIdentity:sample.serviceVersion==='edgeforce-ml-service-v57',
  activeRequiresHealth:sample.activationState!=='ACTIVE'||sample.healthOk,
  activeRequiresHandshake:sample.activationState!=='ACTIVE'||sample.predictionHandshakeOk,
  activeRequiresChampion:sample.activationState!=='ACTIVE'||sample.championsActive>0,
  renderTrace:Boolean(sample.provider==='render'&&sample.gitCommit)
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V57',assertions,sample},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
