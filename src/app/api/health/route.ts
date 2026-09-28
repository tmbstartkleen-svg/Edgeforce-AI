import {dbHealth} from '@/lib/db';
export async function GET(){
 const database=await dbHealth();
 return Response.json({ok:true,app:'Edgeforce AI',version:'7.0.0',database,time:new Date().toISOString()});
}
