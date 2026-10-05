import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildDailyEdgePlan} from '@/lib/adaptiveRouter';
import {buildMasterEdgeBoard} from '@/lib/masterEdge';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const url=new URL(req.url);
 const limit=Math.max(10,Math.min(100,Number(url.searchParams.get('limit')||50)));
 const [ingestion,learnedWeights,dynamicCalibrationProfiles,prediction,router]=await Promise.all([
  ingestOdds(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles(),
  fetchPredictionMarkets(),
  buildDailyEdgePlan()
 ]);
 const context=await enrichMarketsWithContext(ingestion.markets);
 const sports=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibrationProfiles)
  .filter(x=>x.bucket==='TODAY');
 const universal=buildUniversalSnapshot(ingestion.markets,prediction.contracts);
 const report=buildMasterEdgeBoard({
  sports,
  markets:universal.markets,
  router,
  limit
 });
 return Response.json({
  ok:report.board.length>0,
  analyticsOnly:true,
  executionEnabled:false,
  source:{
   sportsbook:ingestion.source,
   sportsbookProvider:ingestion.providerName,
   predictionMarkets:prediction.source,
   predictionMode:prediction.mode
  },
  warnings:[...(ingestion.warnings||[]),...(prediction.warnings||[])],
  ...report
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
