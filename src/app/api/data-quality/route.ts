import {demoMarkets} from '@/lib/demo';
import {scanMarkets} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';
import {auditMarketBatch} from '@/lib/dataQuality';
import {ingestOdds} from '@/lib/providers/ingest';

export const dynamic='force-dynamic';

export async function GET(){
 const ingestion=await ingestOdds();
 return Response.json({
  ok:true,
  source:ingestion.source,
  providerId:ingestion.providerId,
  audit:auditMarketBatch(ingestion.markets)
 },{status:ingestion.markets.length?200:503,headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const provided=Array.isArray(body?.markets)&&body.markets.length?body.markets:null;
 const production=(process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV)==='production';
 if(!provided&&production&&process.env.ALLOW_DEMO_DATA!=='true'){
  return Response.json({ok:false,error:'Explicit market rows are required; production demo fallback is disabled'},{status:400,headers:{'Cache-Control':'no-store'}});
 }
 const markets=provided||demoMarkets;
 const rows=scanMarkets(markets,body?.risk||'Moderate');
 return Response.json({
  ok:true,
  audit:auditMarketBatch(markets),
  rows:applyQualityGate(rows,body?.observations||{})
 },{headers:{'Cache-Control':'no-store'}});
}
