import {fairAmerican} from './math';
import {db} from './db';
import type {MasterEdgeOpportunity} from './masterEdge';

export type PriceTargetState='GREAT_PRICE'|'GOOD_PRICE'|'ACCEPTABLE'|'THIN_EDGE'|'NO_EDGE';

export type PriceTargetRow=MasterEdgeOpportunity & {
 fairProbability:number;
 fairAmericanOdds:number|null;
 greatPriceProbability:number;
 goodPriceProbability:number;
 acceptablePriceProbability:number;
 noEdgeProbability:number;
 currentValueState:PriceTargetState;
 currentEdgePoints:number;
 targetEdgePoints:number;
 valueScore:number;
 thresholdConfidence:number;
 display:{
  fair:string;
  great:string;
  good:string;
  acceptable:string;
  noEdge:string;
  current:string;
 };
 reason:string;
};

const clamp=(n:number,min=.001,max=.999)=>Math.max(min,Math.min(max,n));

function sportsbookLabel(p:number){
 return String(fairAmerican(clamp(p)));
}

function marketLabel(p:number){
 return Math.round(clamp(p)*100)+'¢';
}

function classify(row:MasterEdgeOpportunity,good:number,acceptable:number,noEdge:number):PriceTargetState{
 const p=row.marketProbability;
 const positive=row.modelProbability>=row.marketProbability;
 if(positive){
  if(p<=good-.025)return 'GREAT_PRICE';
  if(p<=good)return 'GOOD_PRICE';
  if(p<=acceptable)return 'ACCEPTABLE';
  if(p<noEdge)return 'THIN_EDGE';
  return 'NO_EDGE';
 }
 // For negative-edge/NO-style opportunities the direction is reversed.
 if(p>=good+.025)return 'GREAT_PRICE';
 if(p>=good)return 'GOOD_PRICE';
 if(p>=acceptable)return 'ACCEPTABLE';
 if(p>noEdge)return 'THIN_EDGE';
 return 'NO_EDGE';
}

export function buildPriceTarget(row:MasterEdgeOpportunity):PriceTargetRow{
 const fairProbability=clamp(row.modelProbability);
 const uncertainty=Math.max(.012,Math.min(.06,(1-row.confidence)*.08));
 const baseBuffer=Math.max(.012,Math.min(.05,.018+(1-row.masterScore)*.04+uncertainty*.35));
 const positive=row.modelProbability>=row.marketProbability;

 let greatPriceProbability:number;
 let goodPriceProbability:number;
 let acceptablePriceProbability:number;
 let noEdgeProbability:number;

 if(positive){
  noEdgeProbability=clamp(fairProbability-baseBuffer*.15);
  acceptablePriceProbability=clamp(fairProbability-baseBuffer);
  goodPriceProbability=clamp(fairProbability-baseBuffer*1.75);
  greatPriceProbability=clamp(fairProbability-baseBuffer*2.5);
 }else{
  noEdgeProbability=clamp(fairProbability+baseBuffer*.15);
  acceptablePriceProbability=clamp(fairProbability+baseBuffer);
  goodPriceProbability=clamp(fairProbability+baseBuffer*1.75);
  greatPriceProbability=clamp(fairProbability+baseBuffer*2.5);
 }

 const currentValueState=classify(row,goodPriceProbability,acceptablePriceProbability,noEdgeProbability);
 const currentEdgePoints=Math.abs(row.modelProbability-row.marketProbability)*100;
 const targetEdgePoints=Math.abs(row.modelProbability-goodPriceProbability)*100;
 const liquidityAdjustment=row.domain==='MARKETS'?.75+.25*row.liquidityScore:1;
 const valueScore=Math.max(0,Math.min(1,(currentEdgePoints/12)*.45+row.confidence*.25+row.masterScore*.20+liquidityAdjustment*.10));
 const thresholdConfidence=Math.max(.2,Math.min(.98,row.confidence*.55+row.masterScore*.30+row.freshnessScore*.15));
 const label=row.domain==='SPORTS'?sportsbookLabel:marketLabel;

 return {
  ...row,
  fairProbability,
  fairAmericanOdds:row.domain==='SPORTS'?fairAmerican(fairProbability):null,
  greatPriceProbability,
  goodPriceProbability,
  acceptablePriceProbability,
  noEdgeProbability,
  currentValueState,
  currentEdgePoints,
  targetEdgePoints,
  valueScore,
  thresholdConfidence,
  display:{
   fair:label(fairProbability),
   great:label(greatPriceProbability),
   good:label(goodPriceProbability),
   acceptable:label(acceptablePriceProbability),
   noEdge:label(noEdgeProbability),
   current:label(row.marketProbability)
  },
  reason:
   currentValueState==='GREAT_PRICE'?'Current market price is materially better than the model-derived good-price threshold.':
   currentValueState==='GOOD_PRICE'?'Current market price clears the preferred value threshold.':
   currentValueState==='ACCEPTABLE'?'Current market price still clears the minimum value threshold, but with less cushion.':
   currentValueState==='THIN_EDGE'?'Only a narrow model-market advantage remains; re-check before relying on it.':
   'Current market price no longer clears the model-derived value threshold.'
 };
}

export function buildPriceTargetBoard(board:MasterEdgeOpportunity[]){
 const rows=board.map(buildPriceTarget).sort((a,b)=>b.valueScore-a.valueScore||b.currentEdgePoints-a.currentEdgePoints);
 return {
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
   great:rows.filter(x=>x.currentValueState==='GREAT_PRICE').length,
   good:rows.filter(x=>x.currentValueState==='GOOD_PRICE').length,
   acceptable:rows.filter(x=>x.currentValueState==='ACCEPTABLE').length,
   thin:rows.filter(x=>x.currentValueState==='THIN_EDGE').length,
   noEdge:rows.filter(x=>x.currentValueState==='NO_EDGE').length
  },
  notes:[
   'Price targets are model-derived thresholds, not guarantees that a price will move or that an outcome will win.',
   'Sportsbook thresholds are displayed as fair American odds; prediction-market thresholds are displayed as probability cents.',
   'Confidence, freshness, Master Edge quality and liquidity influence the width of the acceptable price band.'
  ]
 };
}


export async function persistPriceTargets(rows:PriceTargetRow[]){
 const sql=db();
 if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from price_target_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<5*60000)return {persisted:false};
 for(const x of rows){
  await sql`
   insert into price_target_snapshots(
    observed_at,opportunity_id,domain,category,venue,fair_probability,current_market_probability,
    great_price_probability,good_price_probability,acceptable_price_probability,no_edge_probability,
    current_value_state,current_edge_points,target_edge_points,value_score,threshold_confidence,metadata
   ) values(
    now(),${x.id},${x.domain},${x.category},${x.venue},${x.fairProbability},${x.marketProbability},
    ${x.greatPriceProbability},${x.goodPriceProbability},${x.acceptablePriceProbability},${x.noEdgeProbability},
    ${x.currentValueState},${x.currentEdgePoints},${x.targetEdgePoints},${x.valueScore},${x.thresholdConfidence},
    ${sql.json(x.metadata as any)}
   )
  `;
 }
 return {persisted:true};
}
