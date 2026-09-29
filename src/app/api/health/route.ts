import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
 const database=await dbHealth();
 const providers=configuredProviders();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'15.0.0',
  sportEngines:11,
  historicalLearning:true,
  portfolioOptimizer:true,
  autonomousDecisionEngine:true,
  interactiveControlRoom:true,
  dataQualityGate:true,
  providerHealth:true,
  providerNormalization:true,
  providerFailover:true,
  migrationAutomation:true,
  configuredProviderCount:providers.length,
  database,
  time:new Date().toISOString()
 });
}
