import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(){
 const started=Date.now();
 const database=await dbHealth();
 const providers=configuredProviders();
 return Response.json({
  ok:true,
  live:true,
  app:'Edgeforce AI',
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  migrationVersion:RELEASE.migrationVersion,
  releaseCandidate:true,
  productionHardened:true,
  readinessEndpoint:true,
  operationalHeartbeat:true,
  structuredObservability:true,
  providerReconciliation:true,
  providerCircuitBreaker:true,
  providerPayloadFreshnessGate:true,
  staleStoredOddsRejection:true,
  degradedModeDisclosure:true,
  persistentWagerLedger:true,
  automaticSettlement:true,
  bankrollPerformanceAnalytics:true,
  walkForwardCalibration:true,
  controlledWeightPromotion:true,
  settledPredictionFeedback:true,
  calibratedModelSnapshots:true,
  automaticContextResimulation:true,
  contextChangeAudit:true,
  serverlessContextState:true,
  liveMarketRepricing:true,
  lineMovementTracking:true,
  steamDetection:true,
  automaticClosingLineCapture:true,
  signedClvTracking:true,
  sportEngines:19,
  securityHardening:true,
  productionSmokeTests:true,
  hostedPreviewGate:true,
  promotionWorkflow:true,
  rollbackWorkflow:true,
  configuredProviderCount:providers.length,
  database,
  durationMs:Date.now()-started,
  time:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
