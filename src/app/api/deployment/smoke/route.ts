import {dbHealth} from '@/lib/db';

export async function GET(){
 const database=await dbHealth();
 const required=['NEXT_RUNTIME'];
 const env={node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'};
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  smoke:true,
  version:'14.0.0',
  database,
  env,
  checks:{
   runtime:true,
   api:true,
   databaseConfigured:database.configured
  },
  required
 });
}
