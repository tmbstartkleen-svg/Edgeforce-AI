import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {rankDaily,rankWeekly} from '@/lib/boardScoring';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {uploadedBetHistory} from '@/lib/betHistory';
import {analyzeHistory} from '@/lib/historyAnalytics';
import {detectAnomalies} from '@/lib/anomaly';
import type {RiskProfile} from '@/lib/types';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';

export const dynamic='force-dynamic';

let oddsCache:{at:number;value:{ingestion:Awaited<ReturnType<typeof ingestOdds>>;context:Awaited<ReturnType<typeof enrichMarketsWithContext>>}}|null=null;
const SOURCE_TTL_MS=10000;

async function cachedOdds(){
  const now=Date.now();
  if(oddsCache&&now-oddsCache.at<SOURCE_TTL_MS)return oddsCache.value;
  const ingestion=await ingestOdds();
  const context=await enrichMarketsWithContext(ingestion.markets);
  const value={ingestion:{...ingestion,markets:context.markets},context};
  oddsCache={at:now,value};
  return value;
}

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const view=searchParams.get('view')==='week'?'week':'today';
  const limit=searchParams.get('limit')==='50'?50:30;
  const requestedRisk=searchParams.get('risk')||'Moderate';
  const risk=(requestedRisk==='Conservative'||requestedRisk==='Aggressive'?requestedRisk:'Moderate') as RiskProfile;

  const [cached,predictions,learnedWeights]=await Promise.all([
    cachedOdds(),
    fetchPredictionMarkets().catch(()=>({mode:'failed',source:null,contracts:[],attempts:[],error:'prediction provider unavailable'})),
    loadLearnedWeightMultipliers()
  ]);

  const ingestion=cached.ingestion;
  const scanned=scanMarkets(ingestion.markets,risk,new Date(),learnedWeights);
  const rows=view==='today'?rankDaily(scanned,limit):rankWeekly(scanned,limit);
  const sports=[...new Set(rows.map(x=>x.sport))].sort();

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
    learnedWeightCount:Object.keys(learnedWeights).length,
    contextDiagnostics:cached.context.diagnostics,
    warnings:ingestion.warnings,
    rows,
    sports,
    predictions,
    history:analyzeHistory(uploadedBetHistory),
    historicalBets:uploadedBetHistory,
    anomalies:detectAnomalies(rows).slice(0,20)
  },{
    headers:{'Cache-Control':'no-store, max-age=0'}
  });
}
