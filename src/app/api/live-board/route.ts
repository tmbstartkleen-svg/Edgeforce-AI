import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {qualifiesForTopBoard,rankDaily,rankWeekly} from '@/lib/boardScoring';
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
import {loadLineMovement} from '@/lib/lineMovement';
import {steamAlert} from '@/lib/alerts';
import {loadLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {fetchLiveScoreMesh} from '@/lib/liveScoreMesh';
import {fetchFanDuelOddsPulse} from '@/lib/providers/fanLineWire';

export const dynamic='force-dynamic';

let oddsCache:{at:number;value:{
  ingestion:Awaited<ReturnType<typeof ingestOdds>>;
  context:Awaited<ReturnType<typeof enrichMarketsWithContext>>;
  contextChanges:ReturnType<typeof detectMaterialContextChanges>;
  contextRevision:string;
}}|null=null;
let lastContextMarkets:Market[]=[];
const SOURCE_TTL_MS=10000;

async function withTimeout<T>(promise:Promise<T>,timeoutMs:number,label:string):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    return await Promise.race([
      promise,
      new Promise<T>((_,reject)=>{
        timer=setTimeout(
          ()=>reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      })
    ]);
  }finally{
    if(timer)clearTimeout(timer);
  }
}

async function cachedOdds(force=false){
  const now=Date.now();
  if(!force&&oddsCache&&now-oddsCache.at<SOURCE_TTL_MS)return oddsCache.value;

  const ingestion=await withTimeout(
    ingestOdds({forceLive:force}),
    Math.max(5000,Number(process.env.LIVE_BOARD_INGEST_TIMEOUT_MS||14000)),
    'odds ingestion'
  );

  let context:Awaited<ReturnType<typeof enrichMarketsWithContext>>;
  try{
    context=await withTimeout(
      enrichMarketsWithContext(ingestion.markets),
      Math.max(3000,Number(process.env.LIVE_BOARD_CONTEXT_TIMEOUT_MS||7000)),
      'context enrichment'
    );
  }catch(error){
    context={
      markets:ingestion.markets,
      diagnostics:{
        degraded:true,
        fallback:'raw-odds',
        reason:error instanceof Error?error.message:'context enrichment timed out',
        matchedRows:0,
        totalRows:ingestion.markets.length
      }
    } as Awaited<ReturnType<typeof enrichMarketsWithContext>>;
  }

  const previousStored=await withTimeout(
    loadContextMarketStates(),
    2000,
    'context state load'
  ).catch(()=>[]);
  const previous=previousStored.length?previousStored:lastContextMarkets;
  const contextChanges=detectMaterialContextChanges(previous,context.markets);
  const revision=contextRevision(context.markets);

  await Promise.all([
    withTimeout(recordContextChanges(contextChanges),1500,'context change persistence').catch(()=>0),
    withTimeout(saveContextMarketStates(context.markets,revision),1500,'context state persistence').catch(()=>0)
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

  const [cached,predictions,learnedWeights,ledgerHistory,learnedSgpCorrelations,dynamicCalibrationProfiles,liveScores,fanduelPulse]=await Promise.all([
    withTimeout(
      cachedOdds(forceRefresh),
      Math.max(12000,Number(process.env.LIVE_BOARD_CORE_TIMEOUT_MS||24000)),
      'live-board odds/context pipeline'
    ).catch(()=>null),
    withTimeout(
      fetchPredictionMarkets(),
      Math.max(2000,Number(process.env.LIVE_BOARD_PREDICTION_TIMEOUT_MS||6000)),
      'prediction markets'
    ).catch(()=>({mode:'failed',source:null,contracts:[],attempts:[],error:'prediction provider timed out'} as Awaited<ReturnType<typeof fetchPredictionMarkets>>)),
    withTimeout(loadLearnedWeightMultipliers(),4000,'learned weights').catch(()=>({} as Awaited<ReturnType<typeof loadLearnedWeightMultipliers>>)),
    withTimeout(loadLedgerHistory(),4000,'ledger history').catch(()=>([] as Awaited<ReturnType<typeof loadLedgerHistory>>)),
    withTimeout(loadLearnedSgpCorrelations(),4000,'SGP correlations').catch(()=>({} as Awaited<ReturnType<typeof loadLearnedSgpCorrelations>>)),
    withTimeout(loadDynamicCalibrationProfiles(),4000,'dynamic calibration').catch(()=>({} as Awaited<ReturnType<typeof loadDynamicCalibrationProfiles>>)),
    withTimeout(fetchLiveScoreMesh(),6000,'live score mesh').catch(()=>({ok:false,generatedAt:new Date().toISOString(),refreshMs:5000,sourceMode:'unavailable',sources:[],liveGames:0,games:[],warnings:['live score mesh timed out']} as Awaited<ReturnType<typeof fetchLiveScoreMesh>>)),
    withTimeout(fetchFanDuelOddsPulse(),6000,'FanDuel pulse').catch(()=>({ok:false,source:'fanlinewire',mode:'keyless-public-snapshot',generatedAt:null,sequence:null,liveTotal:0,prematchTotal:0,rows:[],drops:[],latencyMs:0,fresh:false,ageMs:null,warning:'FanDuel pulse timed out'} as Awaited<ReturnType<typeof fetchFanDuelOddsPulse>>))
  ]);

  if(!cached){
    await withTimeout(recordPerformance('/api/live-board',Date.now()-started,503,'timeout'),1000,'performance logging').catch(()=>undefined);
    return Response.json({
      ok:false,
      error:'LIVE_BOARD_CORE_TIMEOUT',
      message:'The odds/context pipeline exceeded its deadline. EdgeForce returned control instead of hanging.',
      generatedAt:new Date().toISOString()
    },{
      status:503,
      headers:{'Cache-Control':'no-store, max-age=0'}
    });
  }

  const ingestion=cached.ingestion;
  const [scanned,lineMovement]=await Promise.all([
    Promise.resolve(scanMarkets(ingestion.markets,risk,new Date(),learnedWeights,dynamicCalibrationProfiles)),
    withTimeout(loadLineMovement(ingestion.markets),4000,'line movement').catch(()=>new Map())
  ]);
  const triggeredIds=new Set(cached.contextChanges.map(x=>x.marketId));
  const resimulatedRows=scanned.filter(x=>triggeredIds.has(x.id));
  if(resimulatedRows.length)await withTimeout(recordModelRuns(resimulatedRows),2000,'model-run persistence').catch(()=>0);
  const resimulationResults=resimulatedRows.map(x=>({
    marketId:x.id,
    selection:x.selection,
    simProbability:x.simProbability,
    modelProbability:x.modelProb,
    expectedValue:x.expectedValue,
    grade:x.grade,
    simEngine:x.simEngine
  }));
  const boardCandidates=view==='today'?scanned.filter(x=>x.bucket==='TODAY'):scanned;
  const qualifiedCandidates=boardCandidates.filter(qualifiesForTopBoard);
  const ranked=view==='today'?rankDaily(scanned,limit):rankWeekly(scanned,limit);
  const rows=fusePredictionMarkets(ranked,predictions.contracts,minPredictionVolume).map(row=>({
    ...row,
    lineMovement:lineMovement.get(row.id)||null
  }));
  const steamAlerts=rows.map(x=>x.lineMovement?steamAlert(x.id,x.lineMovement.probabilityMove,x.lineMovement.snapshotCount,x.lineMovement.direction):null).filter(Boolean);
  const sports=[...new Set(rows.map(x=>x.sport))].sort();
  const predictionCoverage={
    minimumVolume:minPredictionVolume,
    matched:rows.filter(x=>x.predictionMarketStatus==='MATCHED').length,
    illiquid:rows.filter(x=>x.predictionMarketStatus==='ILLIQUID').length,
    unknownLiquidity:rows.filter(x=>x.predictionMarketStatus==='UNKNOWN_LIQUIDITY').length,
    unmatched:rows.filter(x=>x.predictionMarketStatus==='NO_MATCH').length
  };

  const consensusRows=rows.filter(x=>x.consensus);
  const consensusCoverage={
    targetBook:ingestion.targetBook||process.env.TARGET_BOOKMAKER||'DraftKings',
    configuredFeeds:ingestion.providerPanel?.length||0,
    acceptedFeeds:(ingestion.providerPanel||[]).filter(x=>x.acceptedMarkets>0).length,
    rows:consensusRows.length,
    multiBookRows:consensusRows.filter(x=>(x.consensus?.bookCount||0)>=2).length,
    targetBookRows:consensusRows.filter(x=>x.consensus?.targetBookFound).length,
    averageAgreement:consensusRows.length?consensusRows.reduce((s,x)=>s+(x.consensus?.agreement||0),0)/consensusRows.length:0,
    averageDispersion:consensusRows.length?consensusRows.reduce((s,x)=>s+(x.consensus?.dispersion||0),0)/consensusRows.length:0,
    priceShopOpportunities:consensusRows.filter(x=>(x.consensus?.bestOdds??x.odds)>x.odds).length,
    outlierRows:consensusRows.filter(x=>(x.consensus?.outlierBooks.length||0)>0).length,
    classifiedRows:consensusRows.filter(x=>x.consensus?.marketStructure!=='UNCLASSIFIED').length,
    sharpOverPublic:consensusRows.filter(x=>x.consensus?.marketStructure==='SHARP_OVER_PUBLIC').length,
    publicOverSharp:consensusRows.filter(x=>x.consensus?.marketStructure==='PUBLIC_OVER_SHARP').length,
    aligned:consensusRows.filter(x=>x.consensus?.marketStructure==='ALIGNED').length
  };

  const regimeCoverage={
    stable:rows.filter(x=>x.regime==='STABLE').length,
    volatile:rows.filter(x=>x.regime==='VOLATILE').length,
    dislocated:rows.filter(x=>x.regime==='DISLOCATED').length,
    thin:rows.filter(x=>x.regime==='THIN').length,
    unknown:rows.filter(x=>x.regime==='UNKNOWN').length,
    highConfidence:rows.filter(x=>x.confidenceLabel==='HIGH').length,
    mediumConfidence:rows.filter(x=>x.confidenceLabel==='MEDIUM').length,
    lowConfidence:rows.filter(x=>x.confidenceLabel==='LOW').length,
    averageDynamicConfidence:rows.length?rows.reduce((sum,x)=>sum+x.dynamicConfidence,0)/rows.length:0
  };

  await withTimeout(recordPerformance('/api/live-board',Date.now()-started,200,ingestion.providerId),1000,'performance logging').catch(()=>undefined);
  return Response.json({
    generatedAt:new Date().toISOString(),
    uiRefreshMs:1000,
    sourceRefreshMs:ingestion.liveRefreshMs??SOURCE_TTL_MS,
    nextLiveRefreshMs:ingestion.nextLiveRefreshMs??0,
    view,
    limit,
    risk,
    source:ingestion.source,
    persistedReuseAgeMin:ingestion.reuseAgeMin??null,
    providerId:ingestion.providerId,
    providerName:ingestion.providerName,
    providerMode:ingestion.mode,
    providerDegraded:ingestion.degraded,
    providerQuality:ingestion.quality||null,
    providerAttempts:ingestion.attempts,
    targetBook:ingestion.targetBook,
    providerPanel:ingestion.providerPanel,
    consensusCoverage,
    learnedWeightCount:Object.keys(learnedWeights).length,
    learnedSgpCorrelations,
    learnedSgpProfileCount:Object.keys(learnedSgpCorrelations).length,
    dynamicCalibrationProfileCount:Object.keys(dynamicCalibrationProfiles).length,
    regimeCoverage,
    contextDiagnostics:cached.context.diagnostics,
    contextRevision:cached.contextRevision,
    contextChanges:cached.contextChanges,
    resimulationTriggered:cached.contextChanges.length>0,
    resimulatedMarketIds:[...triggeredIds],
    resimulationResults,
    warnings:ingestion.warnings,
    liveScores,
    fanduelPulse,
    topBoardQualification:{
      requested:limit,
      candidates:boardCandidates.length,
      qualified:qualifiedCandidates.length,
      shown:rows.length,
      withheld:Math.max(0,boardCandidates.length-qualifiedCandidates.length),
      forced:false,
      minimumSimProbability:.52,
      minimumDynamicConfidence:.50,
      allowedGrades:['ELITE','STRONG']
    },
    rows,
    sports,
    predictions,
    predictionCoverage,
    steamCount:rows.filter(x=>x.lineMovement?.steam).length,
    steamAlerts,
    history:analyzeHistory(ledgerHistory),
    historicalBets:ledgerHistory,
    anomalies:detectAnomalies(rows).slice(0,20)
  },{
    headers:{'Cache-Control':'no-store, max-age=0'}
  });
}
