import {ingestOdds} from '@/lib/providers/ingest';
import {configuredProviders} from '@/lib/providers/config';
import {auditMarketBatch} from '@/lib/dataQuality';
import {RELEASE} from '@/lib/releaseManifest';
import {fetchFanDuelOddsPulse} from '@/lib/providers/fanLineWire';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const requireLive=url.searchParams.get('requireLive')==='1'||url.searchParams.get('requireLive')==='true';
 const requireUsable=url.searchParams.get('requireUsable')==='1'||url.searchParams.get('requireUsable')==='true';
 const requestedStoredAge=Number(url.searchParams.get('maxStoredAgeMin'));
 const storedReuseMaxAgeMin=Number.isFinite(requestedStoredAge)&&requestedStoredAge>0?requestedStoredAge:undefined;
 try{
  const [ingestion,pulse]=await Promise.all([
   ingestOdds({forceLive:requireLive,storedReuseMaxAgeMin}),
   fetchFanDuelOddsPulse().catch(()=>null)
  ]);
  const oddsProviders=configuredProviders('ODDS');
  const audit=auditMarketBatch(ingestion.markets);
  const sports=[...new Set(ingestion.markets.map(x=>x.sport))].sort();
  const pulseRows=pulse?.rows?.filter(x=>x.status==='OPEN'||x.inplay||x.prices.length>0)||[];
  const pulsePriceCount=pulseRows.reduce((sum,row)=>sum+row.prices.filter(p=>Number.isFinite(Number(p.american))).length,0);
  const pulseUsable=Boolean(pulse?.ok&&pulse.fresh&&pulseRows.length>0&&pulsePriceCount>0);
  const usable=ingestion.source==='live'||ingestion.source==='stored'||pulseUsable;
  const effectiveSource=ingestion.source==='unavailable'&&pulseUsable?'pulse':ingestion.source;
  return Response.json({
   ok:true,
   connected:ingestion.source==='live'||pulseUsable,
   usable,
   productionRealDataOnly:(process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV)==='production'&&process.env.ALLOW_DEMO_DATA!=='true',
   build:RELEASE.build,
   version:RELEASE.appVersion,
   modelVersion:RELEASE.modelVersion,
   source:effectiveSource,
   providerId:ingestion.providerId||null,
   providerName:ingestion.providerName||null,
   providerMode:ingestion.mode,
   providerDegraded:ingestion.degraded,
   targetBook:ingestion.targetBook,
   configuredOddsProviders:oddsProviders.length,
   credentialConfigured:Boolean(process.env.THE_ODDS_API_KEY)||oddsProviders.some(x=>Boolean(x.apiKey)),
   marketCount:ingestion.markets.length,
   pulseMarketRows:pulseRows.length,
   pulsePriceCount,
   pulseFresh:Boolean(pulse?.fresh),
   pulseAgeMs:pulse?.ageMs??null,
   persistedReuseAgeMin:ingestion.reuseAgeMin??null,
   sports,
   quality:audit,
   warnings:[
    ...ingestion.warnings,
    ...(pulseUsable&&ingestion.source==='unavailable'
      ?['Full normalized odds are unavailable; serving a fresh real FanDuel pulse as quota continuity']
      :[])
   ],
   attempts:ingestion.attempts,
   generatedAt:new Date().toISOString(),
  },{status:(requireLive&&ingestion.source!=='live')||(requireUsable&&!usable)||(ingestion.source==='unavailable'&&!pulseUsable)?503:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('live-data-status failed',error);
  return Response.json({
   ok:false,
   connected:false,
   usable:false,
   build:RELEASE.build,
   version:RELEASE.appVersion,
   modelVersion:RELEASE.modelVersion,
   reason:'provider-ingestion-exception',
   errorType:error instanceof Error?error.name:'UnknownError',
   generatedAt:new Date().toISOString()
  },{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
