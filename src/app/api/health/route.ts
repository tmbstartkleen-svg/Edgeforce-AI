import {dbHealth} from '@/lib/db';
export async function GET(){
 const database=await dbHealth();
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  version:'9.0.0',
  sportEngines:11,
  historicalLearning:true,
  walkForwardBacktesting:true,
  database,
  time:new Date().toISOString()
 });
}
