import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
 const database=await dbHealth();
 const providers=configuredProviders();
 return Response.json({
  ok:true,app:'Edgeforce AI',version:'26.0.0',releaseCandidate:true,
  v22AutoSimulation:true,v23AutomatedSettlement:true,v24PlayerPropSettlement:true,v25PregameResimulation:true,v26ConfidenceChangeEngine:true,meaningfulChangeDetection:true,weeklyLegDecisionStatuses:true,trueEventMonteCarlo:true,
  probabilityBandCalibration:true,automaticModelLearning:true,propSpecificCalibration:true,
  sharpApiPrimary:true,theOddsApiFallback:true,noVigNormalization:true,weeklyParlayBuilder:true,cashLedger:true,postReleaseOps:true,
  liveDataIntelligence:true,providerReconciliation:true,clvAnalytics:true,calibrationMap:true,rollingModelRankings:true,liveProbabilityBoard:true,
  predictionMarketAdapter:true,screenshotHistoryAnalytics:true,anomalySignals:true,confidenceDecay:true,overUnderConfidenceDetection:true,
  sportEngines:19,historicalLearning:true,portfolioOptimizer:true,autonomousDecisionEngine:true,interactiveControlRoom:true,dataQualityGate:true,
  providerNormalization:true,providerFailover:true,securityHardening:true,productionSmokeTests:true,hostedPreviewGate:true,promotionWorkflow:true,
  rollbackWorkflow:true,configuredProviderCount:providers.length,database,time:new Date().toISOString()
 });
}
