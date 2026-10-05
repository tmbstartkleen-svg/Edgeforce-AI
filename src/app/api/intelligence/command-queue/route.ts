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
import {analyzeOpportunityLifecycle} from '@/lib/edgeLifecycle';
import {buildEarlyCashoutLadder} from '@/lib/earlyCashout';
import {buildOpportunityCommandQueue} from '@/lib/opportunityCommandQueue';
import {db} from '@/lib/db';

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
 const scanned=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibrationProfiles);
 const sports=scanned.filter(x=>x.bucket==='TODAY');
 const universal=buildUniversalSnapshot(odds.markets,prediction.contracts);
 const master=buildMasterEdgeBoard({sports,markets:universal.markets,router,limit:50});
 const [timing,lifecycle]=await Promise.all([
  analyzeEntryWindows(master.board),
  analyzeOpportunityLifecycle(master.board)
 ]);
 const prices=buildPriceTargetBoard(master.board);
 const best=buildBestPriceBoard({consensus:odds.markets,panel:odds.panelMarkets||[],universal:universal.markets});
 const decisions=buildFinalDecisionGate({
  master:master.board,
  timing:timing.rows,
  prices:prices.rows,
  best:best.rows,
  execution:execution.rows
 });
 const cashout=buildEarlyCashoutLadder(sports,20);
 const report=buildOpportunityCommandQueue({
  decisions:decisions.rows,
  lifecycle:[...lifecycle.rows,...lifecycle.exits],
  cashout
 });

 const sql=db();
 let persisted=false;
 if(sql&&report.rows.length){
  const latest=await sql`select max(observed_at) as latest from opportunity_command_queue`;
  const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
  if(!latestMs||Date.now()-latestMs>=5*60000){
   for(const x of report.rows){
    await sql`
     insert into opportunity_command_queue(
      observed_at,command_id,command_type,severity,domain,category,title,action,score,expires_at,dedupe_key,cooldown_minutes,reasons
     ) values(
      now(),${x.id},${x.type},${x.severity},${x.domain},${x.category},${x.title},${x.action},${x.score},
      ${x.expiresAt??null},${x.dedupeKey},${x.cooldownMinutes},${sql.json(x.reasons as any)}
     )
    `;
   }
   persisted=true;
  }
 }

 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  persisted,
  ...report
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
