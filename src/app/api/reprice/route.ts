import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {repriceMarket} from '@/lib/repricing';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const ingestion=await ingestOdds();
 const enriched=await enrichMarketsWithContext(ingestion.markets);
 const market=body?.market||enriched.markets.find(x=>x.id===body?.marketId);
 if(!market)return Response.json({ok:false,error:'Market not found in current live/stored feed'},{status:404});
 const repriced=repriceMarket(market,body?.context||{
  injury:body?.injury,
  weather:body?.weather,
  homeAdvantage:body?.homeAdvantage,
  lineMovePct:body?.lineMovePct
 });
 const learnedWeights=await loadLearnedWeightMultipliers();
 const scanned=scanMarkets([repriced],body?.risk||'Moderate',new Date(),learnedWeights)[0]||null;
 return Response.json({
  ok:true,
  source:ingestion.source,
  providerName:ingestion.providerName,
  market,
  repriced,
  scanned
 });
}
