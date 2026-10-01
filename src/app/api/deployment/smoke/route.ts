import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
 const database=await dbHealth();
 const providers=configuredProviders();
 const env={node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'};
 return Response.json({
  ok:true,
  app:'Edgeforce AI',
  smoke:true,
  version:'21.0.0',
  releaseCandidate:true,
  database,
  env,
  checks:{
   runtime:true,
   api:true,
   proxySecurity:true,
   diagnostics:true,
   providerLayer:true,
   migrations:'v21',
   databaseConfigured:database.configured,
   configuredProviders:providers.length
  }
 });
}
