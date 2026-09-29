import {dbHealth} from '@/lib/db';
export async function GET(){
 const database=await dbHealth();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'10.0.0',
  sportEngines:11,
  historicalLearning:true,
  walkForwardBacktesting:true,
  portfolioOptimizer:true,
  drawdownControls:true,
  cashoutModel:true,
  database,
  time:new Date().toISOString()
 });
}
