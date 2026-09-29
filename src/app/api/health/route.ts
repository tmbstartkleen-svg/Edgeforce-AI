import {dbHealth} from '@/lib/db';
export async function GET(){
 const database=await dbHealth();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'13.0.0',
  sportEngines:11,
  historicalLearning:true,
  portfolioOptimizer:true,
  autonomousDecisionEngine:true,
  liveOperatingConsole:true,
  interactiveControlRoom:true,
  marketDrilldown:true,
  whatIfSimulation:true,
  alertAcknowledgement:true,
  database,
  time:new Date().toISOString()
 });
}
