import {ingestOdds} from '@/lib/providers/ingest';
import {configuredProviders} from '@/lib/providers/config';
import {auditMarketBatch} from '@/lib/dataQuality';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const requireLive=url.searchParams.get('requireLive')==='1'||url.searchParams.get('requireLive')==='true';
 const ingestion=await ingestOdds();
 const oddsProviders=configuredProviders('ODDS');
 const audit=auditMarketBatch(ingestion.markets);
 const sports=[...new Set(ingestion.markets.map(x=>x.sport))].sort();
 return Response.json({
  ok:true,
  connected:ingestion.source==='live',
  usable:ingestion.source==='live'||ingestion.source==='stored',
  productionRealDataOnly:(process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV)==='production'&&process.env.ALLOW_DEMO_DATA!=='true',
  build:RELEASE.build,
  version:RELEASE.appVersion,
  modelVersion:RELEASE.modelVersion,
  source:ingestion.source,
  providerId:ingestion.providerId||null,
  providerName:ingestion.providerName||null,
  providerMode:ingestion.mode,
  providerDegraded:ingestion.degraded,
  targetBook:ingestion.targetBook,
  configuredOddsProviders:oddsProviders.length,
  credentialConfigured:Boolean(process.env.THE_ODDS_API_KEY)||oddsProviders.some(x=>Boolean(x.apiKey)),
  marketCount:ingestion.markets.length,
  sports,
  quality:audit,
  warnings:ingestion.warnings,
  attempts:ingestion.attempts,
  generatedAt:new Date().toISOString(),
 },{status:(requireLive&&ingestion.source!=='live')||ingestion.source==='unavailable'?503:200,headers:{'Cache-Control':'no-store'}});
}
