import {dbHealth} from './db';
import {configuredProviders} from './providers/config';

export async function getOpsStatus(){
 const database=await dbHealth();
 const providers=configuredProviders();
 const providerCounts=providers.reduce<Record<string,number>>((acc,p)=>{
  acc[p.capability]=(acc[p.capability]||0)+1;
  return acc;
 },{});

 return {
  ok:true,
  version:'18.0.0',
  deployment:{
   vercel:Boolean(process.env.VERCEL),
   environment:process.env.VERCEL_ENV||'local',
   url:process.env.VERCEL_URL||null,
   commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
   projectId:process.env.VERCEL_PROJECT_ID||null
  },
  uptimeSeconds:Math.round(process.uptime()),
  database,
  providers:providerCounts,
  memory:process.memoryUsage(),
  time:new Date().toISOString()
 };
}
