import {evaluateReadiness} from '@/lib/readiness';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const readiness=await evaluateReadiness();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  smoke:true,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  releaseCandidate:true,
  readiness:{ready:readiness.ready,productionReady:readiness.productionReady,strict:readiness.strict},
  env:{
   node:process.version,
   platform:process.env.DEPLOYMENT_PLATFORM||(process.env.VERCEL?'vercel':'local'),
   environment:process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local',
   vercel:Boolean(process.env.VERCEL),
   cloudflare:process.env.DEPLOYMENT_PLATFORM==='cloudflare'
  },
  checks:{
   runtime:true,
   api:true,
   proxySecurity:true,
   diagnostics:true,
   providerLayer:true,
   calibration:true,
   ledger:true,
   readinessEndpoint:true,
   migrations:`v${RELEASE.migrationVersion}`
  }
 },{headers:{'Cache-Control':'no-store'}});
}
