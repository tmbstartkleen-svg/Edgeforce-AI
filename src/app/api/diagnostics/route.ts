import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';

export async function GET(){
 const database=await dbHealth();
 const providers=configuredProviders().map(p=>({
  id:p.id,capability:p.capability,priority:p.priority,enabled:p.enabled,urlConfigured:Boolean(p.url),keyConfigured:Boolean(p.apiKey)
 }));
 return Response.json({
  ok:true,
  version:'16.0.0',
  uptimeSeconds:Math.round(process.uptime()),
  memory:process.memoryUsage(),
  database,
  providers,
  runtime:{node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'},
  time:new Date().toISOString()
 });
}
