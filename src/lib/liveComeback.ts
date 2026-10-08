import type {Market} from './types';
import {assessContextQuality,summarizeContextQuality} from './contextQuality';

export type LiveComebackLineMovement={
 openerOdds:number;
 currentOdds:number;
 openerProbability:number;
 currentProbability:number;
 probabilityMove:number;
 oddsMove:number;
 snapshotCount:number;
 direction:'TOWARD'|'AWAY'|'FLAT';
 steam:boolean;
 steamStrength:'NONE'|'WATCH'|'STRONG';
};

export type LiveComebackMarket={
 id:string;
 sport:string;
 league?:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 odds:number;
 marketProb:number;
 simProbability:number;
 dynamicConfidence:number;
 agreement:number;
 grade:'ELITE'|'STRONG'|'WATCH'|'PASS';
 regime:string;
 freshness:'FRESH'|'AGING'|'STALE';
 contextQuality?:{
  recommendationReady?:boolean;
  coverage?:number;
  criticalCoverage?:number;
  score?:number;
 };
 lineMovement?:LiveComebackLineMovement|null;
};

export type LiveComebackAction='BUY_LOW_REVIEW'|'WATCH';

export type LiveComebackCandidate={
 id:string;
 sport:string;
 league?:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 started:boolean;
 likelyLiveWindow:boolean;
 action:LiveComebackAction;
 score:number;
 simProbability:number;
 marketProbability:number;
 dynamicConfidence:number;
 modelMarketEdge:number;
 probabilityDrop:number;
 currentOdds:number;
 openerOdds?:number;
 snapshotCount:number;
 steamStrength:string;
 reason:string;
 riskFlags:string[];
 requiresGameStateConfirmation:true;
 missingGameState:string[];
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

export const LIVE_COMEBACK_MAX_MARKETS=24;

export function prepareWorkerSafeLiveComebackMarkets(markets:Market[],now=new Date(),limit=LIVE_COMEBACK_MAX_MARKETS){
 const nowMs=now.getTime();
 const bounded=[...markets]
  .filter(m=>{
   const start=new Date(m.startTime).getTime();
   if(!Number.isFinite(start))return false;
   const minutesFromStart=(nowMs-start)/60000;
   return minutesFromStart>=-2&&minutesFromStart<=360;
  })
  .sort((a,b)=>(Number(a.sourceAgeMin)||0)-(Number(b.sourceAgeMin)||0)||new Date(b.startTime).getTime()-new Date(a.startTime).getTime())
  .slice(0,Math.max(1,Math.min(40,limit)))
  .map(m=>({...m,contextQuality:m.contextQuality||assessContextQuality(m)}));
 return {
  markets:bounded,
  diagnostics:{
   profile:'WORKER_SAFE_LIVE_COMEBACK',
   inputMarkets:markets.length,
   liveWindowMarkets:bounded.length,
   maxMarkets:Math.max(1,Math.min(40,limit)),
   externalContextRequests:0,
   reusedContextRows:bounded.filter(m=>(m.contextSources||[]).length>0).length,
   qualitySummary:summarizeContextQuality(bounded)
  }
 };
}

function supportedLiveSport(row:LiveComebackMarket){
 const label=(row.sport+' '+(row.league||'')).toUpperCase();
 return [
  'NFL','NCAAF','FOOTBALL','NBA','WNBA','NCAAB','BASKETBALL',
  'NHL','HOCKEY','MLB','BASEBALL','MLS','EPL','SOCCER','TENNIS'
 ].some(x=>label.includes(x));
}

function candidateReason(action:LiveComebackAction,drop:number,edge:number){
 const move=(drop*100).toFixed(1);
 const advantage=(edge*100).toFixed(1);
 return action==='BUY_LOW_REVIEW'
  ?`Market probability fell ${move} pts while Edgeforce still shows a ${advantage}-pt simulation advantage. Verify score, clock/period and availability before any entry.`
  :`Potential buy-low setup: market moved against the selection by ${move} pts while the model remains ${advantage} pts higher. Live game state is still required.`;
}

export function buildLiveComebackWatch(rows:LiveComebackMarket[],now=new Date()){
 const nowMs=now.getTime();
 const candidates:LiveComebackCandidate[]=[];

 for(const row of rows){
  if(!supportedLiveSport(row)||row.grade==='PASS')continue;

  const startMs=new Date(row.startTime).getTime();
  if(!Number.isFinite(startMs))continue;
  const minutesFromStart=(nowMs-startMs)/60000;
  const started=minutesFromStart>=-2;
  const likelyLiveWindow=minutesFromStart>=-2&&minutesFromStart<=360;
  if(!likelyLiveWindow)continue;

  const line=row.lineMovement;
  const snapshotCount=line?.snapshotCount||0;
  const marketProbability=line?.currentProbability??row.marketProb;
  const probabilityDrop=line?Math.max(0,-line.probabilityMove):0;
  const modelMarketEdge=row.simProbability-marketProbability;
  const contextReady=Boolean(row.contextQuality?.recommendationReady);
  const fresh=row.freshness==='FRESH';
  const stable=row.regime!=='DISLOCATED';
  const hasMovement=Boolean(line&&snapshotCount>=2);
  const steamStrength=line?.steamStrength||'NONE';

  const riskFlags:string[]=[];
  if(!hasMovement)riskFlags.push('INSUFFICIENT_LINE_HISTORY');
  if(!contextReady)riskFlags.push('CONTEXT_NOT_RECOMMENDATION_READY');
  if(!fresh)riskFlags.push(row.freshness==='STALE'?'STALE_MARKET_DATA':'AGING_MARKET_DATA');
  if(!stable)riskFlags.push('DISLOCATED_MARKET_REGIME');
  if(row.dynamicConfidence<.58)riskFlags.push('LOW_DYNAMIC_CONFIDENCE');
  if(row.simProbability<.62)riskFlags.push('SIM_BELOW_BUY_LOW_GATE');
  if(modelMarketEdge<.08)riskFlags.push('EDGE_BELOW_BUY_LOW_GATE');
  if(probabilityDrop<.03)riskFlags.push('PRICE_DROP_BELOW_BUY_LOW_GATE');

  const reviewReady=
   started&&hasMovement&&contextReady&&fresh&&stable
   &&(row.grade==='ELITE'||row.grade==='STRONG')
   &&row.simProbability>=.62
   &&row.dynamicConfidence>=.58
   &&modelMarketEdge>=.08
   &&probabilityDrop>=.03;

  const watchReady=
   started&&hasMovement&&fresh&&stable
   &&row.simProbability>=.56
   &&row.dynamicConfidence>=.50
   &&modelMarketEdge>=.04
   &&probabilityDrop>=.015;

  if(!reviewReady&&!watchReady)continue;

  const action:LiveComebackAction=reviewReady?'BUY_LOW_REVIEW':'WATCH';
  const score=Math.round(100*clamp(
   .30*row.simProbability
   +.20*row.dynamicConfidence
   +.20*clamp(modelMarketEdge/.20)
   +.20*clamp(probabilityDrop/.12)
   +.10*clamp(row.agreement)
  ));

  candidates.push({
   id:row.id,
   sport:row.sport,
   league:row.league,
   event:row.event,
   selection:row.selection,
   market:row.market,
   startTime:row.startTime,
   started,
   likelyLiveWindow,
   action,
   score,
   simProbability:row.simProbability,
   marketProbability,
   dynamicConfidence:row.dynamicConfidence,
   modelMarketEdge,
   probabilityDrop,
   currentOdds:line?.currentOdds??row.odds,
   openerOdds:line?.openerOdds,
   snapshotCount,
   steamStrength,
   reason:candidateReason(action,probabilityDrop,modelMarketEdge),
   riskFlags,
   requiresGameStateConfirmation:true,
   missingGameState:['score','clock_or_period','possession_or_server','live_injury_status']
  });
 }

 candidates.sort((a,b)=>{
  if(a.action!==b.action)return a.action==='BUY_LOW_REVIEW'?-1:1;
  return b.score-a.score||b.modelMarketEdge-a.modelMarketEdge||b.probabilityDrop-a.probabilityDrop;
 });

 return {
  generatedAt:now.toISOString(),
  methodology:'MARKET_MOVE_PLUS_MODEL_EDGE',
  gameStateVerified:false,
  executionEnabled:false,
  summary:{
   candidates:candidates.length,
   buyLowReview:candidates.filter(x=>x.action==='BUY_LOW_REVIEW').length,
   watch:candidates.filter(x=>x.action==='WATCH').length,
   sports:[...new Set(candidates.map(x=>x.sport))].sort()
  },
  candidates:candidates.slice(0,20),
  warnings:[
   'This module does not infer a halftime score, game clock, possession/server, or live injury state from odds movement alone.',
   'BUY_LOW_REVIEW means the pricing/model conditions cleared review gates; live game state must still be independently confirmed before any decision.',
   'No automatic wagering or order execution is enabled.'
  ]
 };
}
