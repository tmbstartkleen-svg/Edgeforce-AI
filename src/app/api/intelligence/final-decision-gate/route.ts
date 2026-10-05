import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildDailyEdgePlan} from '@/lib/adaptiveRouter';
import {buildMasterEdgeBoard} from '@/lib/masterEdge';
import {analyzeEntryWindows} from '@/lib/entryWindow';
import {buildPriceTargetBoard} from '@/lib/priceTargets';
import {buildBestPriceBoard} from '@/lib/bestPrice';
import {loadExecutionFeedback} from '@/lib/executionFeedback';
import {buildFinalDecisionGate} from '@/lib/finalDecisionGate';

export const dynamic='force-dynamic';

export async function GET(){
 const [odds,learnedWeights,dynamicCalibrationProfiles,prediction,router,execution]=await Promise.all([
  ingestOdds(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles(),
  fetchPredictionMarkets(),
  buildDailyEdgePlan(),
  loadExecutionFeedback()
 ]);
 const context=await enrichMarketsWithContext(odds.markets);
 const sports=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibrationProfiles).filter(x=>x.bucket==='TODAY');
 const universal=buildUniversalSnapshot(odds.markets,prediction.contracts);
 const master=buildMasterEdgeBoard({sports,markets:universal.markets,router,limit:50});
 const [timing,prices,best]=await Promise.all([
  analyzeEntryWindows(master.board),
  Promise.resolve(buildPriceTargetBoard(master.board)),
  Promise.resolve(buildBestPriceBoard({consensus:odds.markets,panel:odds.panelMarkets||[],universal:universal.markets}))
 ]);
 const report=buildFinalDecisionGate({
  master:master.board,
  timing:timing.rows,
  prices:prices.rows,
  best:best.rows,
  execution:execution.rows
 });
 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  ...report
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
