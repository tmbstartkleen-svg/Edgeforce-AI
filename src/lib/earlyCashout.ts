import type {Scanned} from './scanner';
import {decimalOdds} from './math';

export type EarlyCashoutLeg={
 id:string;
 order:number;
 sport:string;
 event:string;
 selection:string;
 market:string;
 startTime:string;
 odds:number;
 simProbability:number;
 dynamicConfidence:number;
 expectedValue:number;
 grade:string;
 finalRiskLeg:boolean;
};

export type EarlyCashoutCheckpoint={
 afterLeg:number;
 label:string;
 remainingLegs:number;
 remainingModelProbability:number;
 theoreticalHoldMultiple:number;
 instruction:string;
};

export type EarlyCashoutLadder={
 generatedAt:string;
 legCount:number;
 legs:EarlyCashoutLeg[];
 finalRiskLeg:EarlyCashoutLeg|null;
 combinedDecimalOdds:number;
 combinedAmericanOdds:number;
 independentProbability:number;
 checkpointPlan:EarlyCashoutCheckpoint[];
 notes:string[];
};

function americanFromDecimal(decimal:number){
 const profit=Math.max(.000001,decimal-1);
 return profit>=1?Math.round(profit*100):Math.round(-100/profit);
}

function confidence(row:Scanned){
 return row.dynamicConfidence??row.confidence;
}

function isQualified(row:Scanned){
 return row.grade!=='PASS' &&
  row.freshness!=='STALE' &&
  row.simProbability>=.55 &&
  confidence(row)>=.52 &&
  row.expectedValue>0 &&
  (row.contextQuality?.recommendationReady!==false);
}

function startMs(row:Scanned){
 const value=new Date(row.startTime).getTime();
 return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
}

function uniqueEvents(rows:Scanned[]){
 const seen=new Set<string>();
 return rows.filter(row=>{
  const key=(row.sport+'|'+row.event).toLowerCase();
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
}

function qualityScore(row:Scanned){
 const grade=row.grade==='ELITE'?.10:row.grade==='STRONG'?.06:.02;
 const freshness=row.freshness==='FRESH'?.04:.01;
 const marketBonus=row.market.toLowerCase().includes('money')?.02:0;
 return row.simProbability*.56+confidence(row)*.20+Math.min(.20,Math.max(-.10,row.expectedValue))*.50+grade+freshness+marketBonus;
}

function lateWindow(rows:Scanned[]){
 if(rows.length<=4)return rows;
 const sorted=[...rows].sort((a,b)=>startMs(a)-startMs(b));
 return sorted.slice(Math.floor(sorted.length*.65));
}

function finalLegScore(row:Scanned){
 const longerOdds=row.odds>0?Math.min(1,row.odds/700):0;
 return longerOdds*.48+row.simProbability*.30+confidence(row)*.12+Math.max(0,row.expectedValue)*.10;
}

function buildCheckpoints(legs:EarlyCashoutLeg[]):EarlyCashoutCheckpoint[]{
 if(legs.length<2)return [];
 const marks=[3,5,8,10,12,15,18].filter(x=>x<legs.length);
 if(!marks.includes(legs.length-1))marks.push(legs.length-1);
 return [...new Set(marks)].sort((a,b)=>a-b).map(afterLeg=>{
  const remaining=legs.slice(afterLeg);
  const remainingModelProbability=remaining.reduce((p,x)=>p*x.simProbability,1);
  const remainingDecimal=remaining.reduce((p,x)=>p*decimalOdds(x.odds),1);
  const theoreticalHoldMultiple=remainingModelProbability*remainingDecimal;
  return {
   afterLeg,
   label:afterLeg===legs.length-1?'Before final risk leg':`After leg ${afterLeg}`,
   remainingLegs:remaining.length,
   remainingModelProbability,
   theoreticalHoldMultiple,
   instruction:afterLeg===legs.length-1
    ?'Primary cash-out review: compare the live offer with model hold value before the final longest-odds leg starts.'
    :'Review only if the sportsbook offers a cash-out; compare the offer with the value of the remaining modeled legs.'
  };
 });
}

export function buildEarlyCashoutLadder(rows:Scanned[],limit=20):EarlyCashoutLadder{
 const target=Math.max(2,Math.min(20,Math.round(limit)));
 const qualified=uniqueEvents(rows.filter(isQualified));
 const byTime=[...qualified].sort((a,b)=>startMs(a)-startMs(b)||qualityScore(b)-qualityScore(a));

 if(byTime.length<2){
  return {
   generatedAt:new Date().toISOString(),
   legCount:0,
   legs:[],
   finalRiskLeg:null,
   combinedDecimalOdds:1,
   combinedAmericanOdds:0,
   independentProbability:0,
   checkpointPlan:[],
   notes:['Not enough qualified, distinct events are available to construct the Early Cash-Out Ladder.']
  };
 }

 const finalCandidates=lateWindow(byTime)
  .filter(x=>x.odds>=-180)
  .sort((a,b)=>finalLegScore(b)-finalLegScore(a)||startMs(b)-startMs(a));
 const final=finalCandidates[0]||byTime.at(-1)!;

 const earlier=byTime
  .filter(x=>x.id!==final.id&&startMs(x)<=startMs(final))
  .sort((a,b)=>startMs(a)-startMs(b)||qualityScore(b)-qualityScore(a));

 const diversified:Scanned[]=[];
 for(const row of earlier){
  if(diversified.length>=target-1)break;
  const sameSportRecent=diversified.slice(-3).filter(x=>x.sport===row.sport).length;
  if(sameSportRecent>=2)continue;
  diversified.push(row);
 }
 if(diversified.length<Math.min(target-1,earlier.length)){
  for(const row of earlier){
   if(diversified.length>=target-1)break;
   if(!diversified.some(x=>x.id===row.id))diversified.push(row);
  }
 }

 const selected=[...diversified.slice(0,target-1),final];
 const legs:EarlyCashoutLeg[]=selected.map((row,index)=>({
  id:row.id,
  order:index+1,
  sport:row.sport,
  event:row.event,
  selection:row.selection,
  market:row.market,
  startTime:row.startTime,
  odds:row.odds,
  simProbability:row.simProbability,
  dynamicConfidence:confidence(row),
  expectedValue:row.expectedValue,
  grade:row.grade,
  finalRiskLeg:index===selected.length-1
 }));

 const combinedDecimalOdds=legs.reduce((p,x)=>p*decimalOdds(x.odds),1);
 const independentProbability=legs.reduce((p,x)=>p*x.simProbability,1);

 return {
  generatedAt:new Date().toISOString(),
  legCount:legs.length,
  legs,
  finalRiskLeg:legs.at(-1)||null,
  combinedDecimalOdds,
  combinedAmericanOdds:americanFromDecimal(combinedDecimalOdds),
  independentProbability,
  checkpointPlan:buildCheckpoints(legs),
  notes:[
   'Legs are ordered by scheduled start time so the ticket can accumulate settled value through the day.',
   'The final leg is selected from later events and intentionally carries the longest acceptable odds among qualified candidates.',
   'Cash-out offers are sportsbook-specific and may be unavailable; this module does not assume an offer exists or guarantee profit.',
   'Use the live cash-out calculator to compare an actual offer with the model hold value before accepting it.'
  ]
 };
}
