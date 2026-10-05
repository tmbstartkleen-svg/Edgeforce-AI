import type {Market} from './types';
import type {UniversalMarketQuote} from './universalMarkets';
import {equivalentContractPair} from './universalMarkets';

export type ExecutionQuality='EXCELLENT'|'GOOD'|'FAIR'|'POOR'|'STALE';

export type BestPriceRow={
 id:string;
 domain:'SPORTS'|'MARKETS';
 title:string;
 category:string;
 bestVenue:string;
 currentVenue:string;
 bestProbability:number;
 currentProbability:number;
 bestAmericanOdds?:number;
 currentAmericanOdds?:number;
 priceImprovementPoints:number;
 equivalentConfidence:number;
 freshnessScore:number;
 liquidityScore:number;
 spreadScore:number;
 executionQuality:ExecutionQuality;
 executionScore:number;
 stale:boolean;
 analyticsOnly:true;
 reason:string;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function quality(score:number,stale:boolean):ExecutionQuality{
 if(stale)return 'STALE';
 if(score>=.82)return 'EXCELLENT';
 if(score>=.68)return 'GOOD';
 if(score>=.52)return 'FAIR';
 return 'POOR';
}

function sportsKey(x:Market){
 return [x.sport,x.event,x.market,x.selection].map(v=>String(v||'').trim().toLowerCase()).join('|');
}

export function buildSportsBestPrice(consensus:Market[],panel:Market[]):BestPriceRow[]{
 const grouped=new Map<string,Market[]>();
 for(const x of panel){
  const k=sportsKey(x);
  grouped.set(k,[...(grouped.get(k)||[]),x]);
 }
 return consensus.map(row=>{
  const quotes=grouped.get(sportsKey(row))||[];
  const currentProb=clamp(row.marketProb);
  const currentOdds=row.odds;
  const freshQuotes=quotes.filter(x=>x.sourceAgeMin<=15);
  const candidatePool=freshQuotes.length?freshQuotes:quotes;
  const best=candidatePool.length
   ?[...candidatePool].sort((a,b)=>b.odds-a.odds)[0]
   :null;
  const bestVenue=best?.sourceBook||row.consensus?.bestBook||row.sourceBook||'Sportsbook';
  const bestOdds=best?.odds??row.consensus?.bestOdds??row.odds;
  const bestProbability=best?.marketProb??row.consensus?.minProbability??currentProb;
  const age=best?.sourceAgeMin??row.sourceAgeMin;
  const stale=age>30;
  const freshnessScore=clamp(1-age/45);
  const equivalentConfidence=quotes.length?1:.85;
  const liquidityScore=.70;
  const spreadScore=1;
  const priceImprovementPoints=Math.max(0,(currentProb-bestProbability)*100);
  const executionScore=clamp(
   freshnessScore*.30+
   equivalentConfidence*.25+
   liquidityScore*.15+
   spreadScore*.10+
   clamp(priceImprovementPoints/4)*.20
  );
  return {
   id:'sports-best:'+row.id+':'+row.market+':'+row.selection,
   domain:'SPORTS',
   title:row.event+' · '+row.selection,
   category:row.sport,
   bestVenue,
   currentVenue:row.sourceBook||row.consensus?.targetBook||'Sportsbook',
   bestProbability,
   currentProbability:currentProb,
   bestAmericanOdds:bestOdds,
   currentAmericanOdds:currentOdds,
   priceImprovementPoints,
   equivalentConfidence,
   freshnessScore,
   liquidityScore,
   spreadScore,
   executionQuality:quality(executionScore,stale),
   executionScore,
   stale,
   analyticsOnly:true,
   reason:best
    ?'Best currently observed sportsbook quote among matching live panel rows.'
    :row.consensus?.bestBook
     ?'Best book is derived from the latest consensus snapshot.'
     :'No alternate sportsbook quote is currently available.'
  };
 });
}

export function buildPredictionBestPrice(rows:UniversalMarketQuote[]):BestPriceRow[]{
 const out:BestPriceRow[]=[];
 for(let i=0;i<rows.length;i++){
  const a=rows[i];
  if(a.domain!=='MARKETS')continue;
  let best:UniversalMarketQuote|undefined;
  let bestSimilarity=0;
  for(let j=0;j<rows.length;j++){
   if(i===j)continue;
   const b=rows[j];
   if(b.domain!=='MARKETS'||a.venue===b.venue)continue;
   const match=equivalentContractPair(a,b);
   if(!match.equivalent)continue;
   if(match.similarity>bestSimilarity){
    best=b;
    bestSimilarity=match.similarity;
   }
  }
  const current=a.impliedProbability;
  const candidate=best&&best.impliedProbability<current?best:a;
  const spread=candidate.bidProbability!==undefined&&candidate.askProbability!==undefined
   ?Math.max(0,candidate.askProbability-candidate.bidProbability)
   :.08;
  const spreadScore=clamp(1-spread/.20);
  const depth=(candidate.liquidity??0)+(candidate.volume??0)*.15;
  const liquidityScore=clamp(Math.log10(1+Math.max(0,depth))/6);
  const freshnessScore=1;
  const equivalentConfidence=best?bestSimilarity:.55;
  const bestProbability=candidate.impliedProbability;
  const priceImprovementPoints=Math.max(0,(current-bestProbability)*100);
  const stale=false;
  const executionScore=clamp(
   equivalentConfidence*.28+
   liquidityScore*.24+
   spreadScore*.22+
   freshnessScore*.10+
   clamp(priceImprovementPoints/4)*.16
  );
  out.push({
   id:'market-best:'+a.id,
   domain:'MARKETS',
   title:a.title,
   category:a.category,
   bestVenue:candidate.venue,
   currentVenue:a.venue,
   bestProbability,
   currentProbability:current,
   priceImprovementPoints,
   equivalentConfidence,
   freshnessScore,
   liquidityScore,
   spreadScore,
   executionQuality:quality(executionScore,stale),
   executionScore,
   stale,
   analyticsOnly:true,
   reason:best
    ?'Equivalent contract found across venues; ranked by price, liquidity and spread quality.'
    :'No verified equivalent cross-venue contract found; current venue remains the reference.'
  });
 }
 return out;
}

export function buildBestPriceBoard(input:{consensus:Market[];panel:Market[];universal:UniversalMarketQuote[]}){
 const rows=[
  ...buildSportsBestPrice(input.consensus,input.panel),
  ...buildPredictionBestPrice(input.universal)
 ].sort((a,b)=>b.executionScore-a.executionScore||b.priceImprovementPoints-a.priceImprovementPoints);
 return {
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
   excellent:rows.filter(x=>x.executionQuality==='EXCELLENT').length,
   good:rows.filter(x=>x.executionQuality==='GOOD').length,
   fair:rows.filter(x=>x.executionQuality==='FAIR').length,
   poor:rows.filter(x=>x.executionQuality==='POOR').length,
   stale:rows.filter(x=>x.executionQuality==='STALE').length,
   improved:rows.filter(x=>x.priceImprovementPoints>0).length
  },
  notes:[
   'Best-price ranking is analytics-only and never submits wagers, orders, cash-outs or trades.',
   'Cross-venue prediction-market comparisons require verified contract equivalence before prices are treated as substitutable.',
   'Sportsbook comparisons penalize stale quotes and use exact event/market/selection matching.'
  ]
 };
}
