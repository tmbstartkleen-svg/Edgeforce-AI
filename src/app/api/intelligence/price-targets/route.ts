import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildDailyEdgePlan} from '@/lib/adaptiveRouter';
import {buildMasterEdgeBoard} from '@/lib/masterEdge';
import {buildPriceTargetBoard} from '@/lib/priceTargets';

export const dynamic='force-dynamic';

export async function GET(){
 const [ingestion,learnedWeights,dynamicCalibrationProfiles,prediction,router]=await Promise.all([
  ingestOdds(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles(),
  fetchPredictionMarkets(),
  buildDailyEdgePlan()
 ]);
 const context=await enrichMarketsWithContext(ingestion.markets);
 const sports=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibrationProfiles).filter(x=>x.bucket==='TODAY');
 const universal=buildUniversalSnapshot(ingestion.markets,prediction.contracts);
 const master=buildMasterEdgeBoard({sports,markets:universal.markets,router,limit:50});
 const report=buildPriceTargetBoard(master.board);
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  analyticsOnly:true,
  executionEnabled:false,
  ...report
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
