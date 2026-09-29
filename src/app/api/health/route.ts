import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
 const database=await dbHealth();
 const providers=configuredProviders();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'18.0.0',
  releaseCandidate:true,
  postReleaseOps:true,
  postReleaseOps:true,
  sportEngines:11,
  historicalLearning:true,
  portfolioOptimizer:true,
  autonomousDecisionEngine:true,
  interactiveControlRoom:true,
  dataQualityGate:true,
  providerNormalization:true,
  providerFailover:true,
  securityHardening:true,
  productionSmokeTests:true,
  hostedPreviewGate:true,
  promotionWorkflow:true,
  rollbackWorkflow:true,
  configuredProviderCount:providers.length,
  database,
  time:new Date().toISOString()
 });
}
