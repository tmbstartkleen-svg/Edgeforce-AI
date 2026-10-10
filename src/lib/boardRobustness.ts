import type {Scanned} from './scanner';

export type BoardRobustnessClass='ROBUST'|'RESILIENT'|'FRAGILE'|'FAIL';

export type BoardRobustness={
 score:number;
 classification:BoardRobustnessClass;
 reviewRequired:boolean;
 components:{
  edgeBuffer:number;
  confidence:number;
  uncertainty:number;
  freshness:number;
  regime:number;
  context:number;
  reliability:number;
  consensus:number;
 };
 reasons:string[];
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function freshnessScore(row:Scanned){
 if(row.freshness==='FRESH')return 1;
 if(row.freshness==='AGING')return .62;
 return .16;
}

function regimeScore(row:Scanned){
 if(row.regime==='STABLE')return 1;
 if(row.regime==='VOLATILE')return .70;
 if(row.regime==='THIN')return .52;
 if(row.regime==='DISLOCATED')return .22;
 return .42;
}

function reliabilityScore(row:Scanned){
 if(row.reliabilityCriticalOpen)return 0;
 if(row.reliabilityMode==='PROTECTIVE')return .12;
 if(row.reliabilityMode==='DEGRADED')return clamp(.42+.30*(row.reliabilityScore??.5));
 return clamp(row.reliabilityScore??1);
}

function consensusScore(row:Scanned){
 const c=row.consensus;
 if(!c)return .34;
 const depth=clamp(c.bookCount/4);
 const agreement=clamp(c.agreement);
 const dispersion=1-clamp(c.dispersion/.12);
 return clamp(depth*.42+agreement*.43+dispersion*.15);
}

export function buildBoardRobustness(row:Scanned):BoardRobustness{
 const edgeBuffer=clamp((Math.max(0,row.edge)-.004)/.056);
 const confidence=clamp((row.dynamicConfidence-.42)/.43);
 const width=Math.max(0,(row.simCi?.[1]??1)-(row.simCi?.[0]??0));
 const uncertainty=1-clamp((width-.035)/.19);
 const freshness=freshnessScore(row);
 const regime=regimeScore(row);
 const contextScore=clamp(row.contextQuality?.score??row.dynamicConfidenceComponents?.contextQuality??.5);
 const intelligence=clamp(((row.intelligenceStackScore??contextScore)+(row.intelligenceCriticalCoverage??contextScore))/2);
 const context=clamp(contextScore*.55+intelligence*.45);
 const reliability=reliabilityScore(row);
 const consensus=consensusScore(row);

 const downgradePenalty=Math.min(.18,(row.downgradeReasons?.length??0)*.035);
 const raw=
  edgeBuffer*.22+
  confidence*.18+
  uncertainty*.14+
  freshness*.10+
  regime*.10+
  context*.10+
  reliability*.10+
  consensus*.06;
 const score=clamp(raw-downgradePenalty);
 const classification:BoardRobustnessClass=
  score>=.78?'ROBUST':
  score>=.62?'RESILIENT':
  score>=.44?'FRAGILE':'FAIL';

 const reasons:string[]=[];
 if(edgeBuffer<.45)reasons.push('thin edge buffer');
 if(confidence<.50)reasons.push('confidence shock sensitivity');
 if(uncertainty<.50)reasons.push('wide simulation interval');
 if(freshness<.50)reasons.push('stale market data');
 if(regime<.50)reasons.push('unstable market regime');
 if(context<.50)reasons.push('thin context coverage');
 if(reliability<.50)reasons.push('reliability protection active');
 if(consensus<.50)reasons.push('limited independent market confirmation');
 if(row.reliabilityCriticalOpen)reasons.unshift('critical reliability circuit open');

 const reviewRequired=
  classification==='FRAGILE'||
  classification==='FAIL'||
  row.freshness==='STALE'||
  Boolean(row.reliabilityCriticalOpen);

 return {
  score,
  classification,
  reviewRequired,
  components:{edgeBuffer,confidence,uncertainty,freshness,regime,context,reliability,consensus},
  reasons:reasons.slice(0,4)
 };
}

export type BoardPriority={
 score:number;
 sim:number;
 robustness:number;
 confidence:number;
 reviewPenalty:number;
 explanation:string[];
};

export function buildBoardPriority(row:Scanned):BoardPriority{
 const robustness=buildBoardRobustness(row);
 const sim=clamp(row.simProbability);
 const confidence=clamp(row.dynamicConfidence);
 const reviewPenalty=robustness.reviewRequired?.08:0;
 const score=clamp(sim*.45+robustness.score*.35+confidence*.20-reviewPenalty);
 const explanation:string[]=[];
 explanation.push(`sim ${Math.round(sim*100)}%`);
 explanation.push(`robustness ${Math.round(robustness.score*100)}%`);
 explanation.push(`confidence ${Math.round(confidence*100)}%`);
 if(reviewPenalty)explanation.push('review penalty');
 for(const reason of robustness.reasons.slice(0,2))explanation.push(reason);
 return {score,sim,robustness:robustness.score,confidence,reviewPenalty,explanation};
}

export function buildBoardRankDeltas(rows:Scanned[]){
 const simRank=new Map([...rows].sort((a,b)=>b.simProbability-a.simProbability).map((row,index)=>[row.id,index+1]));
 const priorityRank=new Map([...rows].sort((a,b)=>buildBoardPriority(b).score-buildBoardPriority(a).score||b.simProbability-a.simProbability).map((row,index)=>[row.id,index+1]));
 return new Map(rows.map(row=>{
  const sim=simRank.get(row.id)??0;
  const priority=priorityRank.get(row.id)??0;
  const delta=sim-priority;
  const label=delta>=3?'UPGRADED':delta<=-3?'DOWNGRADED':'STABLE';
  return [row.id,{simRank:sim,priorityRank:priority,delta,label}] as const;
 }));
}

export function summarizeBoardRankDeltas(rows:Scanned[]){
 const deltas=buildBoardRankDeltas(rows);
 let upgraded=0,downgraded=0,stable=0;
 for(const value of deltas.values()){
  if(value.label==='UPGRADED')upgraded++;
  else if(value.label==='DOWNGRADED')downgraded++;
  else stable++;
 }
 return {total:rows.length,upgraded,downgraded,stable,zeroExtraProviderRequests:true};
}

export function summarizeBoardRobustness(rows:Scanned[]){
 const results=rows.map(buildBoardRobustness);
 const count=(classification:BoardRobustnessClass)=>results.filter(x=>x.classification===classification).length;
 return {
  total:results.length,
  robust:count('ROBUST'),
  resilient:count('RESILIENT'),
  fragile:count('FRAGILE'),
  fail:count('FAIL'),
  reviewRequired:results.filter(x=>x.reviewRequired).length,
  averageScore:results.length?results.reduce((sum,x)=>sum+x.score,0)/results.length:0,
  zeroExtraProviderRequests:true
 };
}
