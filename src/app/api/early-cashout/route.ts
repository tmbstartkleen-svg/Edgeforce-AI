import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {buildEarlyCashoutLadder} from '@/lib/earlyCashout';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const limit=Math.max(2,Math.min(20,Number(url.searchParams.get('limit')||20)));
 const [ingestion,learnedWeights,dynamicCalibrationProfiles]=await Promise.all([
  ingestOdds(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);
 const context=await enrichMarketsWithContext(ingestion.markets);
 const scanned=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibrationProfiles);
 const today=scanned.filter(x=>x.bucket==='TODAY');
 const ladder=buildEarlyCashoutLadder(today,limit);

 return Response.json({
  ok:ladder.legCount>=2,
  generatedAt:new Date().toISOString(),
  analyticsOnly:true,
  executionEnabled:false,
  source:ingestion.source,
  providerName:ingestion.providerName,
  ladder,
  warnings:[
   ...(ingestion.warnings||[]),
   'A high modeled probability is not a guaranteed winner. The ladder is a timing/cash-out planning structure, not a promise of profit.',
   'Actual cash-out availability and pricing are controlled by the sportsbook.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
