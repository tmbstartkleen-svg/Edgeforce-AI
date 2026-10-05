import type {MasterEdgeOpportunity} from './masterEdge';
import type {EntryWindowRow} from './entryWindow';
import type {PriceTargetRow} from './priceTargets';
import type {BestPriceRow} from './bestPrice';
import type {ExecutionFeedbackRow} from './executionFeedback';

export type DecisionState='PRIME'|'READY'|'WATCH'|'HOLD'|'REMOVE';

export type FinalDecisionRow={
 id:string;
 domain:'SPORTS'|'MARKETS';
 category:string;
 venue:string;
 title:string;
 state:DecisionState;
 actionabilityScore:number;
 modelScore:number;
 timingScore:number;
 priceScore:number;
 venueScore:number;
 executionFeedback:number;
 confidence:number;
 reasons:string[];
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

export function buildFinalDecisionGate(input:{
 master:MasterEdgeOpportunity[];
 timing:EntryWindowRow[];
 prices:PriceTargetRow[];
 best:BestPriceRow[];
 execution:ExecutionFeedbackRow[];
}){
 const timingMap=new Map(input.timing.map(x=>[x.id,x]));
 const priceMap=new Map(input.prices.map(x=>[x.id,x]));
 const bestKey=(domain:string,category:string,title:string)=>[domain,category.trim().toLowerCase(),title.trim().toLowerCase()].join('|');
 const bestMap=new Map(input.best.map(x=>[bestKey(x.domain,x.category,x.title),x]));
 const execCategory=new Map(input.execution.filter(x=>x.dimension==='CATEGORY').map(x=>[x.domain+'|'+x.key.toLowerCase(),x]));

 const rows:FinalDecisionRow[]=input.master.map(m=>{
  const t=timingMap.get(m.id);
  const p=priceMap.get(m.id);
  const b=bestMap.get(bestKey(m.domain,m.category,m.title));
  const e=execCategory.get(m.domain+'|'+m.category.toLowerCase());

  const modelScore=clamp(m.masterScore);
  const timingScore=t?clamp(t.timingScore):.5;
  const priceScore=p
   ?p.currentValueState==='GREAT_PRICE'?1:
    p.currentValueState==='GOOD_PRICE'?.86:
    p.currentValueState==='ACCEPTABLE'?.68:
    p.currentValueState==='THIN_EDGE'?.40:.12
   :.5;
  const venueScore=b?clamp(b.executionScore):.5;
  const executionFeedback=e?clamp((e.multiplier-.90)/.20):.5;
  const confidence=clamp(m.confidence*.45+(t?.timingConfidence??.5)*.20+(p?.thresholdConfidence??.5)*.20+(b?.executionScore??.5)*.15);

  let actionabilityScore=clamp(
   modelScore*.34+
   timingScore*.20+
   priceScore*.20+
   venueScore*.12+
   executionFeedback*.06+
   confidence*.08
  );

  const reasons:string[]=[];
  if(t?.timingState==='CLOSED'){actionabilityScore=.05;reasons.push('timing closed');}
  if(t?.timingState==='LATE'){actionabilityScore*=.82;reasons.push('late timing');}
  if(p?.currentValueState==='NO_EDGE'){actionabilityScore*=.45;reasons.push('price no longer clears edge threshold');}
  if(b?.stale){actionabilityScore*=.65;reasons.push('best quote is stale');}
  if(e?.state==='REDUCE'){actionabilityScore*=.94;reasons.push('recent price-capture feedback is weak');}
  if(e?.state==='BOOST')reasons.push('recent price-capture feedback is positive');
  if(t?.timingState==='ENTRY_WINDOW')reasons.push('timing window is active');
  if(p?.currentValueState==='GREAT_PRICE'||p?.currentValueState==='GOOD_PRICE')reasons.push('current price clears preferred threshold');
  if(b?.executionQuality==='EXCELLENT'||b?.executionQuality==='GOOD')reasons.push('cross-venue quote quality is strong');

  let state:DecisionState='WATCH';
  if(actionabilityScore>=.82)state='PRIME';
  else if(actionabilityScore>=.70)state='READY';
  else if(actionabilityScore>=.54)state='WATCH';
  else if(actionabilityScore>=.35)state='HOLD';
  else state='REMOVE';

  return {
   id:m.id,domain:m.domain,category:m.category,venue:m.venue,title:m.title,state,
   actionabilityScore,modelScore,timingScore,priceScore,venueScore,executionFeedback,confidence,reasons
  };
 }).sort((a,b)=>b.actionabilityScore-a.actionabilityScore);

 return {
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
   prime:rows.filter(x=>x.state==='PRIME').length,
   ready:rows.filter(x=>x.state==='READY').length,
   watch:rows.filter(x=>x.state==='WATCH').length,
   hold:rows.filter(x=>x.state==='HOLD').length,
   remove:rows.filter(x=>x.state==='REMOVE').length
  },
  notes:[
   'The Final Decision Gate is an analytics-priority layer, not an automated wagering or trading system.',
   'No single input can force PRIME: model quality, timing, price threshold, quote quality and confidence are blended with hard penalties for stale, late or no-edge states.',
   'REMOVE means remove from analytical priority, not automatically close or cash out an existing position.'
  ]
 };
}
