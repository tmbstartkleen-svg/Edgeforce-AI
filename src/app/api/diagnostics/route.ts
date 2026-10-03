import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';
import {loadProviderHealthStates} from '@/lib/providers/healthStore';
import {providerHealth} from '@/lib/providerRegistry';
import {evaluateReadiness} from '@/lib/readiness';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const [database,states,readiness]=await Promise.all([
  dbHealth(),loadProviderHealthStates(),evaluateReadiness()
 ]);
 const providers=configuredProviders().map(p=>{
  const state=states.get(p.id);
  return {
   id:p.id,capability:p.capability,priority:p.priority,enabled:p.enabled,
   urlConfigured:Boolean(p.url),keyConfigured:Boolean(p.apiKey),
   maxAgeMin:p.maxAgeMin,failureThreshold:p.failureThreshold,quarantineMin:p.quarantineMin,
   health:state?providerHealth(state):null,
   circuitState:state?.circuitState||'CLOSED',
   consecutiveFailures:state?.consecutiveFailures||0,
   quarantinedUntil:state?.quarantinedUntil||null
  };
 });
 const memory=process.memoryUsage();
 return Response.json({
  ok:true,
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  providerHardening:true,
  circuitBreaker:true,
  payloadFreshnessGate:true,
  providerCertification:true,
  launchDoctor:true,
  walkForwardCalibration:true,
  controlledWeightPromotion:true,
  eventLevelJointSimulation:true,
  learnedSgpCorrelation:true,
  sportMicroSimulation:true,
  granularSportEngines:7,
  multiProviderConsensusPricing:true,
  robustConsensusOutliers:true,
  explicitMarketRoleStructure:true,
  regimeDetection:true,
  uncertaintyCalibration:true,
  dynamicConfidence:true,
  portfolioStressTesting:true,
  portfolioVarCvar:true,
  continuousDrawdownBrake:true,
  additiveExplainability:true,
  componentAblation:true,
  featureSensitivity:true,
  modelFragilityDiagnostics:true,
  liveReadOnlyWhatIf:true,
  batchDataContractAudit:true,
  durableAutomationHealth:true,
  productionCertification:true,
  staticReleaseAudit:true,
  mutationBodyLimit:true,
  hardenedContentSecurityPolicy:true,
  readiness:{ready:readiness.ready,productionReady:readiness.productionReady,strict:readiness.strict,requiredFailures:readiness.requiredFailures,warnings:readiness.warnings},
  uptimeSeconds:Math.round(process.uptime()),
  memory:{rss:memory.rss,heapTotal:memory.heapTotal,heapUsed:memory.heapUsed,external:memory.external},
  database,
  providers,
  runtime:{node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'},
  deployment:{url:process.env.VERCEL_URL||null,commit:process.env.VERCEL_GIT_COMMIT_SHA||null},
  time:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
