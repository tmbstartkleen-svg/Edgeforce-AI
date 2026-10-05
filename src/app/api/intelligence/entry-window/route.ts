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
 const timing=await analyzeEntryWindows(master.board);
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  configured:timing.configured,
  persisted:timing.persisted,
  summary:{
   early:timing.rows.filter(x=>x.timingState==='EARLY').length,
   wait:timing.rows.filter(x=>x.timingState==='WAIT').length,
   entryWindow:timing.rows.filter(x=>x.timingState==='ENTRY_WINDOW').length,
   late:timing.rows.filter(x=>x.timingState==='LATE').length,
   closed:timing.rows.filter(x=>x.timingState==='CLOSED').length
  },
  rows:timing.rows.sort((a,b)=>b.timingScore-a.timingScore),
  notes:[
   'Entry-window labels are timing/monitoring signals, not instructions to place a wager or trade.',
   'The engine uses recent Master Edge history, score/edge velocity, volatility, time remaining, confidence, and current edge quality.',
   'No action is automated; prices can move against the model and no timing state guarantees a better outcome.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
