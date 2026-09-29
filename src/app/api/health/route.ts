import {dbHealth} from '@/lib/db';
export async function GET(){
 const database=await dbHealth();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'12.0.0',
  sportEngines:11,
  historicalLearning:true,
  portfolioOptimizer:true,
  autonomousDecisionEngine:true,
  liveOperatingConsole:true,
  alertCenter:true,
  modelHealth:true,
  database,
  time:new Date().toISOString()
 });
}
