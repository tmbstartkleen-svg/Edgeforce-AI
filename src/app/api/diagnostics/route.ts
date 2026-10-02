import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';
import {loadProviderHealthStates} from '@/lib/providers/healthStore';
import {providerHealth} from '@/lib/providerRegistry';

export const dynamic='force-dynamic';

export async function GET(){
 const [database,states]=await Promise.all([dbHealth(),loadProviderHealthStates()]);
 const providers=configuredProviders().map(p=>{
  const state=states.get(p.id);
  return {
   id:p.id,capability:p.capability,priority:p.priority,enabled:p.enabled,
   urlConfigured:Boolean(p.url),keyConfigured:Boolean(p.apiKey),
   maxAgeMin:p.maxAgeMin,failureThreshold:p.failureThreshold,quarantineMin:p.quarantineMin,
   health:state?providerHealth(state):null,
   circuitState:state?.circuitState||'CLOSED',
   consecutiveFailures:state?.consecutiveFailures||0,
   quarantinedUntil:state?.quarantinedUntil||null
  };
 });
 return Response.json({
  ok:true,
  version:'29.0.0',
  providerHardening:true,
  circuitBreaker:true,
  payloadFreshnessGate:true,
  walkForwardCalibration:true,
  controlledWeightPromotion:true,
  uptimeSeconds:Math.round(process.uptime()),
  memory:process.memoryUsage(),
  database,
  providers,
  runtime:{node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'},
  time:new Date().toISOString()
 },{headers:{'Cache-Control':'no-store'}});
}
