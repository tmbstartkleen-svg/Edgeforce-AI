import {dbHealth} from '@/lib/db';
import {configuredProviders} from '@/lib/providers/config';
import {getProductionProviderHealth} from '@/lib/productionHealth';
import {latestFeedIntegrity} from '@/lib/feedIntegrityStore';

export async function GET(){
 const [database,providerHealth,integrityHistory]=await Promise.all([
  dbHealth(),
  getProductionProviderHealth(),
  latestFeedIntegrity(1).catch(()=>[])
 ]);
 const providers=configuredProviders().map(p=>({
  id:p.id,capability:p.capability,priority:p.priority,enabled:p.enabled,urlConfigured:Boolean(p.url),keyConfigured:Boolean(p.apiKey)
 }));
 return Response.json({
  ok:true,
  version:'28.0.0',
  uptimeSeconds:Math.round(process.uptime()),
  memory:process.memoryUsage(),
  database,
  providers,
  providerHealth,
  latestFeedIntegrity:integrityHistory[0]||null,
  productionRules:{
    liveMarketMaxAgeMin:Number(process.env.LIVE_MARKET_MAX_AGE_MIN||12),
    storedMarketMaxAgeMin:Number(process.env.STORED_MARKET_MAX_AGE_MIN||20),
    minOfficialMarkets:Number(process.env.MIN_OFFICIAL_MARKETS||2),
    maxProviderConflictRate:Number(process.env.MAX_PROVIDER_CONFLICT_RATE||.20),
    minReconciliationCoverage:Number(process.env.MIN_RECONCILIATION_COVERAGE||.10),
    strictProviderReconciliation:process.env.STRICT_PROVIDER_RECONCILIATION!=='false'
  },
  runtime:{node:process.version,vercel:Boolean(process.env.VERCEL),environment:process.env.VERCEL_ENV||'local'},
  time:new Date().toISOString()
 });
}
