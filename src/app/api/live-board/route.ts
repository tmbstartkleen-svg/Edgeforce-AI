import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {rankDaily,rankWeekly} from '@/lib/boardScoring';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {loadLedgerHistory} from '@/lib/ledger';
import {analyzeHistory} from '@/lib/historyAnalytics';
import {detectAnomalies} from '@/lib/anomaly';
import type {RiskProfile} from '@/lib/types';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {fusePredictionMarkets} from '@/lib/crossMarket';
import {recordPerformance} from '@/lib/ops';
import type {Market} from '@/lib/types';
import {detectMaterialContextChanges,contextRevision} from '@/lib/contextChanges';
import {loadContextMarketStates,recordContextChanges,saveContextMarketStates,recordModelRuns} from '@/lib/persistence';

export const dynamic='force-dynamic';

let oddsCache:{at:number;value:{
  ingestion:Awaited<ReturnType<typeof ingestOdds>>;
  context:Awaited<ReturnType<typeof enrichMarketsWithContext>>;
  contextChanges:ReturnType<typeof detectMaterialContextChanges>;
  contextRevision:string;
}}|null=null;
let lastContextMarkets:Market[]=[];
const SOURCE_TTL_MS=10000;

async function cachedOdds(force=false){
  const now=Date.now();
  if(!force&&oddsCache&&now-oddsCache.at<SOURCE_TTL_MS)return oddsCache.value;

  const ingestion=await ingestOdds();
  const context=await enrichMarketsWithContext(ingestion.markets);
  const previousStored=await loadContextMarketStates().catch(()=>[]);
  const previous=previousStored.length?previousStored:lastContextMarkets;
  const contextChanges=detectMaterialContextChanges(previous,context.markets);
  const revision=contextRevision(context.markets);

  await Promise.all([
    recordContextChanges(contextChanges).catch(()=>0),
    saveContextMarketStates(context.markets,revision).catch(()=>0)
  ]);
  lastContextMarkets=context.markets;

  const value={
    ingestion:{...ingestion,markets:context.markets},
    context,
    contextChanges,
    contextRevision:revision
  };
  oddsCache={at:now,value};
  return value;
}

export async function GET(req:Request){
  const started=Date.now();
  const {searchParams}=new URL(req.url);
  const view=searchParams.get('view')==='week'?'week':'today';
  const limit=searchParams.get('limit')==='50'?50:30;
  const requestedRisk=searchParams.get('risk')||'Moderate';
  const risk=(requestedRisk==='Conservative'||requestedRisk==='Aggressive'?requestedRisk:'Moderate') as RiskProfile;
  const minPredictionVolume=Math.max(0,Number(process.env.PREDICTION_MIN_VOLUME||1000));
  const forceRefresh=searchParams.get('force')==='1';
  if(forceRefresh&&process.env.INGEST_SECRET&&req.headers.get('authorization')!==`Bearer ${process.env.INGEST_SECRET}`){
    return Response.json({ok:false,error:'unauthorized forced refresh'},{status:401});
  }

  const [cached,predictions,learnedWeights,ledgerHistory]=await Promise.all([
    cachedOdds(forceRefresh),
    fetchPredictionMarkets().catch(()=>({mode:'failed',source:null,contracts:[],attempts:[],error:'prediction provider unavailable'})),
    loadLearnedWeightMultipliers(),
    loadLedgerHistory()
  ]);

  const ingestion=cached.ingestion;
  const scanned=scanMarkets(ingestion.markets,risk,new Date(),learnedWeights);
  const triggeredIds=new Set(cached.contextChanges.map(x=>x.marketId));
  const resimulatedRows=scanned.filter(x=>triggeredIds.has(x.id));
  if(resimulatedRows.length)await recordModelRuns(resimulatedRows).catch(()=>0);
  const resimulationResults=resimulatedRows.map(x=>({
    marketId:x.id,
    selection:x.selection,
    simProbability:x.simProbability,
    modelProbability:x.modelProb,
    expectedValue:x.expectedValue,
    grade:x.grade,
    simEngine:x.simEngine
  }));
  const ranked=view==='today'?rankDaily(scanned,limit):rankWeekly(scanned,limit);
  const rows=fusePredictionMarkets(ranked,predictions.contracts,minPredictionVolume);
  const sports=[...new Set(rows.map(x=>x.sport))].sort();
  const predictionCoverage={
    minimumVolume:minPredictionVolume,
    matched:rows.filter(x=>x.predictionMarketStatus==='MATCHED').length,
    illiquid:rows.filter(x=>x.predictionMarketStatus==='ILLIQUID').length,
    unknownLiquidity:rows.filter(x=>x.predictionMarketStatus==='UNKNOWN_LIQUIDITY').length,
    unmatched:rows.filter(x=>x.predictionMarketStatus==='NO_MATCH').length
  };

  await recordPerformance('/api/live-board',Date.now()-started,200,ingestion.providerId);
  return Response.json({
    generatedAt:new Date().toISOString(),
    uiRefreshMs:1000,
    sourceRefreshMs:SOURCE_TTL_MS,
    view,
    limit,
    risk,
    source:ingestion.source,
    providerId:ingestion.providerId,
    providerName:ingestion.providerName,
    providerMode:ingestion.mode,
    providerDegraded:ingestion.degraded,
    providerQuality:ingestion.quality||null,
    providerAttempts:ingestion.attempts,
    learnedWeightCount:Object.keys(learnedWeights).length,
    contextDiagnostics:cached.context.diagnostics,
    contextRevision:cached.contextRevision,
    contextChanges:cached.contextChanges,
    resimulationTriggered:cached.contextChanges.length>0,
    resimulatedMarketIds:[...triggeredIds],
    resimulationResults,
    warnings:ingestion.warnings,
    rows,
    sports,
    predictions,
    predictionCoverage,
    history:analyzeHistory(ledgerHistory),
    historicalBets:ledgerHistory,
    anomalies:detectAnomalies(rows).slice(0,20)
  },{
    headers:{'Cache-Control':'no-store, max-age=0'}
  });
}
