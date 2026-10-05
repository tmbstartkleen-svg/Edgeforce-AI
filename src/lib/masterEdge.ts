import type {Scanned} from './scanner';
import type {UniversalMarketQuote} from './universalMarkets';
import type {DailyEdgePlan} from './adaptiveRouter';

export type MasterEdgeOpportunity={
 id:string;
 domain:'SPORTS'|'MARKETS';
 category:string;
 venue:string;
 title:string;
 modelProbability:number;
 marketProbability:number;
 edge:number;
 confidence:number;
 routerWeight:number;
 liquidityScore:number;
 freshnessScore:number;
 masterScore:number;
 tier:'A+'|'A'|'B'|'WATCH';
 startOrExpiry?:string;
 sourceType:'SPORTSBOOK'|'PREDICTION_MARKET';
 metadata:Record<string,unknown>;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function routerWeight(plan:DailyEdgePlan,domain:'SPORTS'|'MARKETS',category:string){
 const exact=plan.lanes.filter(x=>x.domain===domain&&x.key.toLowerCase()===category.toLowerCase());
 if(exact.length)return Math.max(...exact.map(x=>x.allocationWeight));
 const categoryLane=plan.lanes.filter(x=>x.domain===domain&&x.dimension==='CATEGORY');
 if(categoryLane.length)return Math.max(...categoryLane.map(x=>x.allocationWeight))*.65;
 return domain==='SPORTS'?plan.sportsWeight*.25:plan.marketsWeight*.25;
}

function tier(score:number):MasterEdgeOpportunity['tier']{
 if(score>=.82)return 'A+';
 if(score>=.70)return 'A';
 if(score>=.58)return 'B';
 return 'WATCH';
}

function sportsOpportunity(row:Scanned,plan:DailyEdgePlan):MasterEdgeOpportunity{
 const rWeight=routerWeight(plan,'SPORTS',row.sport);
 const edge=Number(row.edge||0);
 const modelProbability=clamp(row.simProbability);
 const marketProbability=clamp(row.marketProb);
 const confidence=clamp(row.dynamicConfidence);
 const freshnessScore=row.freshness==='FRESH'?1:row.freshness==='AGING'?.65:.20;
 const contextScore=clamp(row.contextQuality?.score??.5);
 const score=
  clamp(Math.abs(edge)/.14)*.27+
  modelProbability*.18+
  confidence*.22+
  clamp(rWeight/.22)*.13+
  freshnessScore*.08+
  contextScore*.12;
 return {
  id:'sports:'+row.id,
  domain:'SPORTS',
  category:row.sport,
  venue:row.sourceBook||'Sportsbook',
  title:row.event+' · '+row.selection,
  modelProbability,
  marketProbability,
  edge,
  confidence,
  routerWeight:rWeight,
  liquidityScore:.65,
  freshnessScore,
  masterScore:score,
  tier:tier(score),
  startOrExpiry:row.startTime,
  sourceType:'SPORTSBOOK',
  metadata:{
   market:row.market,
   odds:row.odds,
   grade:row.grade,
   freshness:row.freshness,
   simulationRuns:row.simulationRuns,
   confidenceLabel:row.confidenceLabel,
   regime:row.regime
  }
 };
}

function marketOpportunity(row:UniversalMarketQuote,plan:DailyEdgePlan):MasterEdgeOpportunity{
 const rWeight=routerWeight(plan,'MARKETS',row.category);
 const edge=row.edge;
 const modelProbability=clamp(row.modelProbability);
 const marketProbability=clamp(row.impliedProbability);
 const spread=row.bidProbability!==undefined&&row.askProbability!==undefined
  ?Math.max(0,row.askProbability-row.bidProbability)
  :.08;
 const depth=(row.liquidity??0)+(row.volume??0)*.15;
 const liquidityScore=clamp(Math.log10(1+Math.max(0,depth))/6);
 const spreadScore=clamp(1-spread/.20);
 const confidence=clamp(.42+liquidityScore*.28+spreadScore*.20+clamp(Math.abs(edge)/.12)*.10);
 const freshnessScore=1;
 const score=
  clamp(Math.abs(edge)/.18)*.31+
  modelProbability*.16+
  confidence*.18+
  clamp(rWeight/.22)*.13+
  liquidityScore*.14+
  spreadScore*.08;
 return {
  id:row.id,
  domain:'MARKETS',
  category:row.category,
  venue:row.venue,
  title:row.title,
  modelProbability,
  marketProbability,
  edge,
  confidence,
  routerWeight:rWeight,
  liquidityScore,
  freshnessScore,
  masterScore:score,
  tier:tier(score),
  startOrExpiry:row.expiresAt,
  sourceType:'PREDICTION_MARKET',
  metadata:{
   venueType:row.venueType,
   bidProbability:row.bidProbability,
   askProbability:row.askProbability,
   volume:row.volume,
   liquidity:row.liquidity
  }
 };
}

export function buildMasterEdgeBoard(input:{
 sports:Scanned[];
 markets:UniversalMarketQuote[];
 router:DailyEdgePlan;
 limit?:number;
}){
 const limit=Math.max(10,Math.min(100,input.limit??50));
 const sports=input.sports
  .filter(x=>x.grade!=='PASS'&&x.freshness!=='STALE'&&x.simProbability>=.52)
  .map(x=>sportsOpportunity(x,input.router));
 const markets=input.markets
  .filter(x=>x.domain==='MARKETS'&&Math.abs(x.edge)>=.015)
  .map(x=>marketOpportunity(x,input.router));

 const all=[...sports,...markets]
  .sort((a,b)=>b.masterScore-a.masterScore||Math.abs(b.edge)-Math.abs(a.edge));

 const selected:MasterEdgeOpportunity[]=[];
 const domainCount={SPORTS:0,MARKETS:0};
 const categoryCount=new Map<string,number>();
 for(const row of all){
  if(selected.length>=limit)break;
  const domainCap=Math.ceil(limit*.70);
  if(domainCount[row.domain]>=domainCap)continue;
  const catKey=row.domain+'|'+row.category;
  const catCount=categoryCount.get(catKey)||0;
  if(catCount>=Math.max(4,Math.ceil(limit*.20)))continue;
  selected.push(row);
  domainCount[row.domain]++;
  categoryCount.set(catKey,catCount+1);
 }

 return {
  generatedAt:new Date().toISOString(),
  totalCandidates:all.length,
  board:selected,
  sports:selected.filter(x=>x.domain==='SPORTS'),
  markets:selected.filter(x=>x.domain==='MARKETS'),
  tiers:{
   aPlus:selected.filter(x=>x.tier==='A+').length,
   a:selected.filter(x=>x.tier==='A').length,
   b:selected.filter(x=>x.tier==='B').length,
   watch:selected.filter(x=>x.tier==='WATCH').length
  },
  safeguards:{
   maxDomainShare:.70,
   maxCategoryShare:.20,
   minSportsProbability:.52,
   minMarketEdge:.015
  },
  notes:[
   'Master Edge ranks Sports and Markets together for attention only; underlying models and bankroll accounting remain separate.',
   'Ranking includes model edge, confidence, V104 router weight, freshness/context for sports, and liquidity/spread quality for prediction markets.',
   'The board is analytics-only and does not execute wagers or trades.'
  ]
 };
}
