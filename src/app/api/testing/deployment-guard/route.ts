import {evaluateDeploymentGuard,type DeploymentGuardSnapshot} from '@/lib/deploymentGuard';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

const base:DeploymentGuardSnapshot={
 releaseVersion:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,ready:true,productionReady:true,certified:true,
 observabilityOverall:'HEALTHY',observabilityScore:.91,criticalChecks:0,degradedChecks:0,
 reliabilityMode:'NORMAL',reliabilityScore:.94,openCircuits:0,halfOpenCircuits:0,
 automationFailed:0,automationStale:0,actionIncidents:0,watchIncidents:0,
 latestMarketAgeMin:4,latestModelRunAgeMin:12,capturedAt:'2026-10-05T17:00:00Z'
};

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const healthy=evaluateDeploymentGuard(base,{...base,observabilityScore:.90,reliabilityScore:.93,capturedAt:'2026-10-05T17:01:00Z'});
 const softBlock=evaluateDeploymentGuard(base,{...base,observabilityScore:.72,criticalChecks:0,capturedAt:'2026-10-05T17:02:00Z'});
 const hardBlock=evaluateDeploymentGuard(base,{...base,certified:false,observabilityOverall:'CRITICAL',reliabilityMode:'PROTECTIVE',actionIncidents:1,capturedAt:'2026-10-05T17:03:00Z'});
 const ok=healthy.decision==='PASS'&&softBlock.decision==='BLOCK'&&!softBlock.hardBlock&&hardBlock.decision==='BLOCK'&&hardBlock.hardBlock;
 return Response.json({ok,build:'V73',schemaVersion:'v73-deployment-guard-1',healthy,softBlock,hardBlock},{headers:{'Cache-Control':'no-store'}});
}
