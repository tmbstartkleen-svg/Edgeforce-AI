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
 const markets=Array.isArray(body?.markets)&&body.markets.length?body.markets:demoMarkets;
 const rows=scanMarkets(markets,body?.risk||'Moderate');
 return Response.json({
  ok:true,
  audit:auditMarketBatch(markets),
  rows:applyQualityGate(rows,body?.observations||{})
 },{headers:{'Cache-Control':'no-store'}});
}
