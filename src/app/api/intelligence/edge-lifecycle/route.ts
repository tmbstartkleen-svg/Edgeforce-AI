import {ingestOdds} from '@/lib/providers/ingest';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildDailyEdgePlan} from '@/lib/adaptiveRouter';
import {buildMasterEdgeBoard} from '@/lib/masterEdge';
import {analyzeOpportunityLifecycle} from '@/lib/edgeLifecycle';

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
 const lifecycle=await analyzeOpportunityLifecycle(master.board);
 const rows=[...lifecycle.rows,...lifecycle.exits];
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  configured:lifecycle.configured,
  persisted:lifecycle.persisted,
  summary:{
   new:rows.filter(x=>x.lifecycleState==='NEW').length,
   strengthening:rows.filter(x=>x.lifecycleState==='STRENGTHENING').length,
   stable:rows.filter(x=>x.lifecycleState==='STABLE').length,
   weakening:rows.filter(x=>x.lifecycleState==='WEAKENING').length,
   decayed:rows.filter(x=>x.lifecycleState==='DECAYED').length,
   exit:rows.filter(x=>x.lifecycleState==='EXIT').length
  },
  rows:lifecycle.rows,
  exits:lifecycle.exits,
  notes:[
   'Lifecycle status compares the current Master Edge board with recent snapshots.',
   'WEAKENING, DECAYED and EXIT are attention-management signals, not automated cash-out or trade instructions.',
   'Snapshots are throttled to roughly five-minute intervals when database persistence is available.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
