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
  expertModelingSuite:true,
  externalMlModelBridge:Boolean(process.env.EXPERT_MODEL_SERVICE_URL),
  expertTrainingBridgeConfigured:Boolean(process.env.EXPERT_MODEL_SERVICE_URL),
  trainedSportSpecificMl:true,
  trainedModelRegistry:true,
  chronologicalHoldoutTraining:true,
  marketBaselinePromotionGate:true,
  externalMlTournament:true,
  externalMlTrainingConfigured:Boolean(process.env.ML_TRAINING_SERVICE_URL),
  externalMlPredictionConfigured:Boolean(process.env.ML_PREDICTION_SERVICE_URL),
  explicitExternalMlPromotion:true,
  mlServiceHealthConfigured:Boolean(process.env.ML_HEALTH_SERVICE_URL||process.env.ML_PREDICTION_SERVICE_URL),
  mlServiceCircuitBreaker:true,
  renderBlueprint:true,
  persistentMlArtifactDisk:true,
  mlDeploymentAutomation:true,
  renderApiDeploy:true,
  exactMlCommitVerification:true,
  mlDeploymentAttestation:true,
  mlActivationSecretConfigured:Boolean(process.env.ML_ACTIVATION_SECRET),
  firstChampionTournament:true,
  hostedChampionArtifactVerification:true,
  championHistory:true,
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
  championChallengerGovernance:true,
  probabilityDriftDetection:true,
  automaticDriftWeightBrakes:true,
  nativeRealOddsIngestion:true,
  publicPredictionMarketFallback:true,
  runtimeNeonMigrationBootstrap:true,
  liveDataStatus:true,
  productionRealDataOnly:process.env.ALLOW_DEMO_DATA!=='true',
  cloudflareCronAutopilot:true,
  readiness:{ready:readiness.ready,productionReady:readiness.productionReady,strict:readiness.strict,requiredFailures:readiness.requiredFailures,warnings:readiness.warnings},
  uptimeSeconds:Math.round(process.uptime()),
  memory:{rss:memory.rss,heapTotal:memory.heapTotal,heapUsed:memory.heapUsed,external:memory.external},
  database,
  providers,
  runtime:{
   node:process.version,
   platform:process.env.DEPLOYMENT_PLATFORM||(process.env.VERCEL?'vercel':'local'),
   environment:process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local',
   vercel:Boolean(process.env.VERCEL),
   cloudflare:process.env.DEPLOYMENT_PLATFORM==='cloudflare'
  },
  deployment:{
   url:process.env.DEPLOYMENT_URL||process.env.VERCEL_URL||null,
   commit:process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||null
  },
  time:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
