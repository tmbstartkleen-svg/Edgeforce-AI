import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarketsWithOutcomes} from '@/lib/scanner';
import {rankDaily,rankWeekly} from '@/lib/boardScoring';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {attachPredictionProbabilities} from '@/lib/predictionLink';
import {hydratePlayerProjections} from '@/lib/projection';
import {enrichMarketContext} from '@/lib/contextEnrichment';
import {buildTopParlays} from '@/lib/parlays';
import {uploadedBetHistory} from '@/lib/betHistory';
import {analyzeHistory} from '@/lib/historyAnalytics';
import {detectAnomalies} from '@/lib/anomaly';
import {officialScannedEligible} from '@/lib/feedIntegrity';
import type {RiskProfile} from '@/lib/types';

export const dynamic='force-dynamic';

const SOURCE_TTL_MS=30000;

type Core={
  at:number;
  ingestion:Awaited<ReturnType<typeof ingestOdds>>;
  predictions:Awaited<ReturnType<typeof fetchPredictionMarkets>>;
  scanned:ReturnType<typeof scanMarketsWithOutcomes>['rows'];
  hitVectors:Map<string,Uint8Array>;
  contextStatus:{weather:boolean;injuries:boolean;stats:boolean};
};

const coreCache=new Map<string,Core>();

async function cachedCore(risk:RiskProfile){
  const now=Date.now(),cached=coreCache.get(risk);
  if(cached&&now-cached.at<SOURCE_TTL_MS)return cached;

  const [ingestion,predictions]=await Promise.all([
    ingestOdds(),
    fetchPredictionMarkets().catch(()=>({
      mode:'failed',source:null,contracts:[],attempts:[],error:'prediction provider unavailable'
    } as Awaited<ReturnType<typeof fetchPredictionMarkets>>))
  ]);

  if(!ingestion.integrity.officialEligible){
    const value:Core={
      at:now,ingestion,predictions,scanned:[],hitVectors:new Map(),
      contextStatus:{weather:false,injuries:false,stats:false}
    };
    coreCache.set(risk,value);
    return value;
  }

  const contextual=await enrichMarketContext(ingestion.markets);
  const linked=attachPredictionProbabilities(contextual.markets,predictions.contracts);
  const projected=await hydratePlayerProjections(linked);
  const simulation=scanMarketsWithOutcomes(projected,risk);
  const scanned=officialScannedEligible(simulation.rows);

  const value:Core={
    at:now,ingestion,predictions,scanned,hitVectors:simulation.hitVectors,contextStatus:contextual.status
  };
  coreCache.set(risk,value);
  return value;
}

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const view=searchParams.get('view')==='week'?'week':'today';
  const limit=30;
  const requestedRisk=searchParams.get('risk')||'Moderate';
  const risk=(requestedRisk==='Conservative'||requestedRisk==='Aggressive'?requestedRisk:'Moderate') as RiskProfile;
  const minJoint=Math.max(.52,Math.min(.99,Number(searchParams.get('minJoint')||.52)));
  const minLeg=.65;

  const core=await cachedCore(risk);
  const {ingestion,predictions,scanned,hitVectors,contextStatus}=core;
  const officialBoard=ingestion.integrity.officialEligible;

  const rows=officialBoard
    ?(view==='today'?rankDaily(scanned,limit):rankWeekly(scanned,limit))
    :[];

  const candidates=(view==='today'?scanned.filter(x=>x.bucket==='TODAY'):scanned)
    .filter(x=>x.simulationMode!=='probability-fallback'&&x.simProbability>=minLeg);

  const weeklySpread=view==='week';
  const topTwoLeg=officialBoard?buildTopParlays(candidates,2,{
    minJointProbability:minJoint,minLegProbability:minLeg,maxResults:30,maxLegUses:2,
    requireDifferentDays:weeklySpread,hitVectors
  }):[];
  const topThreeLeg=officialBoard?buildTopParlays(candidates,3,{
    minJointProbability:minJoint,minLegProbability:minLeg,maxResults:30,maxLegUses:2,
    requireDifferentDays:weeklySpread,hitVectors
  }):[];
  const valueTwoLeg=officialBoard?buildTopParlays(candidates,2,{
    minJointProbability:minJoint,minLegProbability:minLeg,maxResults:30,maxLegUses:2,
    sortBy:'edge',requireDifferentDays:weeklySpread,hitVectors
  }):[];

  const sports=[...new Set(rows.map(x=>x.sport))].sort();
  const noVigComplete=scanned.filter(x=>x.vigStatus==='complete').length;
  const predictionMatched=scanned.filter(x=>typeof x.predictionProb==='number').length;
  const projectedProps=scanned.filter(x=>x.market==='Player Prop'&&x.simulationMode==='player-projection').length;
  const fallbackSims=scanned.filter(x=>x.simulationMode==='probability-fallback').length;
  const warnings=[
    ...(ingestion.warnings||[]),
    ...(officialBoard?[]:ingestion.integrity.reasons)
  ];

  return Response.json({
    generatedAt:new Date().toISOString(),
    uiRefreshMs:5000,sourceRefreshMs:SOURCE_TTL_MS,view,limit,risk,minJoint,minLeg,
    officialBoard,feedIntegrity:ingestion.integrity,contextStatus,
    source:ingestion.source,providerId:ingestion.providerId,providerName:ingestion.providerName,providerMode:ingestion.mode,
    validation:ingestion.validation,warnings,rows,sports,predictions,
    parlays:{topTwoLeg,topThreeLeg,valueTwoLeg},
    coverage:{
      markets:scanned.length,
      inputMarkets:ingestion.integrity.totalMarkets,
      acceptedFeedMarkets:ingestion.integrity.acceptedMarkets,
      rejectedFeedMarkets:ingestion.integrity.rejectedMarkets,
      noVigComplete,predictionMatched,projectedProps,fallbackSims,
      jointMonteCarloParlays:topTwoLeg.filter(x=>x.jointMode==='shared-monte-carlo').length
    },
    history:analyzeHistory(uploadedBetHistory),
    historicalBets:uploadedBetHistory,
    anomalies:officialBoard?detectAnomalies(rows).slice(0,20):[]
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
