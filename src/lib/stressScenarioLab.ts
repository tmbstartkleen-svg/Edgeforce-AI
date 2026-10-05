import {db} from './db';
import type {MasterEdgeOpportunity} from './masterEdge';
import type {FinalDecisionRow,DecisionState} from './finalDecisionGate';

export type StressScenarioId='ADVERSE_LINE_MOVE'|'MODEL_MISS'|'STALE_FEED'|'LIQUIDITY_CRUNCH'|'CORRELATION_BREAK'|'TAIL_EVENT'|'COMPOUND_SHOCK';
export type StressScenario={id:StressScenarioId;label:string;description:string;domains:Array<'SPORTS'|'MARKETS'|'ALL'>};
export type StressResult={
 scenarioId:StressScenarioId;
 stressedScore:number;
 stressedState:DecisionState;
 scoreDelta:number;
 stateDrop:number;
 edgeAfter:number;
 confidenceAfter:number;
 survivesPriority:boolean;
 reasons:string[];
};
export type StressOpportunityRow={
 id:string;domain:'SPORTS'|'MARKETS';category:string;venue:string;title:string;
 baselineState:DecisionState;baselineScore:number;baselineEdge:number;baselineConfidence:number;
 scenarioResults:StressResult[];
 robustnessScore:number;survivalRate:number;worstScenario:StressScenarioId;worstScore:number;worstState:DecisionState;
 classification:'ROBUST'|'RESILIENT'|'FRAGILE'|'FAIL';
};

export const STRESS_SCENARIOS:StressScenario[]=[
 {id:'ADVERSE_LINE_MOVE',label:'Adverse Line Move',description:'Market price moves 4 probability points against the modeled edge.',domains:['ALL']},
 {id:'MODEL_MISS',label:'Model / Injury Miss',description:'Model probability is shocked 7 points against the position and confidence is reduced.',domains:['SPORTS','ALL']},
 {id:'STALE_FEED',label:'Stale Feed',description:'Freshness and quote confidence collapse as if the primary feed is delayed.',domains:['ALL']},
 {id:'LIQUIDITY_CRUNCH',label:'Liquidity Crunch',description:'Venue execution quality and liquidity deteriorate sharply.',domains:['MARKETS','ALL']},
 {id:'CORRELATION_BREAK',label:'Correlation Breakdown',description:'Dependency assumptions fail and composite confidence is reduced.',domains:['ALL']},
 {id:'TAIL_EVENT',label:'Tail Event',description:'Model probability regresses toward 50% and uncertainty rises materially.',domains:['ALL']},
 {id:'COMPOUND_SHOCK',label:'Compound Shock',description:'Adverse price move, confidence loss, stale data and execution deterioration occur together.',domains:['ALL']}
];

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const stateRank:Record<DecisionState,number>={REMOVE:0,HOLD:1,WATCH:2,READY:3,PRIME:4};
function decisionState(score:number):DecisionState{if(score>=.82)return 'PRIME';if(score>=.70)return 'READY';if(score>=.54)return 'WATCH';if(score>=.35)return 'HOLD';return 'REMOVE';}

function shock(row:MasterEdgeOpportunity,decision:FinalDecisionRow,scenario:StressScenarioId){
 let model=row.modelProbability;
 let market=row.marketProbability;
 let confidence=decision.confidence;
 let modelScore=decision.modelScore;
 let timing=decision.timingScore;
 let price=decision.priceScore;
 let venue=decision.venueScore;
 let feedback=decision.executionFeedback;
 const reasons:string[]=[];
 const direction=row.edge>=0?1:-1;

 if(scenario==='ADVERSE_LINE_MOVE'||scenario==='COMPOUND_SHOCK'){
  market=clamp(market+direction*.04);
  const newEdge=model-market;
  const erosion=Math.max(0,Math.abs(row.edge)-Math.abs(newEdge));
  price=clamp(price-erosion*5-.10);
  modelScore=clamp(modelScore-erosion*2);
  reasons.push('market moved 4 probability points against the original edge');
 }
 if(scenario==='MODEL_MISS'||scenario==='COMPOUND_SHOCK'){
  if(row.domain==='SPORTS'||scenario==='COMPOUND_SHOCK'){
   model=clamp(model-direction*.07);
   confidence=clamp(confidence-.18);
   modelScore=clamp(modelScore-.14);
   reasons.push('model/injury shock reduced probability and confidence');
  }
 }
 if(scenario==='STALE_FEED'||scenario==='COMPOUND_SHOCK'){
  confidence=clamp(confidence-.15);venue=clamp(venue-.28);timing=clamp(timing-.10);
  reasons.push('feed freshness and executable quote confidence deteriorated');
 }
 if(scenario==='LIQUIDITY_CRUNCH'||scenario==='COMPOUND_SHOCK'){
  if(row.domain==='MARKETS'||scenario==='COMPOUND_SHOCK'){venue=clamp(venue-.32);confidence=clamp(confidence-.08);reasons.push('liquidity/depth shock reduced execution quality');}
 }
 if(scenario==='CORRELATION_BREAK'||scenario==='COMPOUND_SHOCK'){
  confidence=clamp(confidence-.12);feedback=clamp(feedback-.10);modelScore=clamp(modelScore-.06);
  reasons.push('dependency/correlation assumptions were stressed');
 }
 if(scenario==='TAIL_EVENT'||scenario==='COMPOUND_SHOCK'){
  model=.5+(model-.5)*.70;confidence=clamp(confidence-.22);modelScore=clamp(modelScore-.10);
  reasons.push('tail-risk shock regressed the model toward uncertainty');
 }

 const edgeAfter=model-market;
 const edgeRetention=Math.abs(row.edge)>0?clamp(Math.abs(edgeAfter)/Math.abs(row.edge),0,1.25):0;
 price=clamp(price*(.65+.35*Math.min(1,edgeRetention)));
 let stressedScore=clamp(modelScore*.34+timing*.20+price*.20+venue*.12+feedback*.06+confidence*.08);
 if(Math.sign(edgeAfter)!==Math.sign(row.edge)||Math.abs(edgeAfter)<.01){stressedScore*=.58;reasons.push('edge crossed direction or fell below one point');}
 if(scenario==='COMPOUND_SHOCK')stressedScore*=.94;
 const stressedState=decisionState(stressedScore);
 return {stressedScore,stressedState,edgeAfter,confidenceAfter:confidence,reasons};
}

export function buildStressScenarioLab(master:MasterEdgeOpportunity[],decisions:FinalDecisionRow[]){
 const decisionMap=new Map(decisions.map(x=>[x.id,x]));
 const rows:StressOpportunityRow[]=[];
 for(const row of master){
  const d=decisionMap.get(row.id);
  if(!d)continue;
  const scenarioResults:StressResult[]=[];
  for(const scenario of STRESS_SCENARIOS){
   if(scenario.id==='MODEL_MISS'&&row.domain!=='SPORTS')continue;
   if(scenario.id==='LIQUIDITY_CRUNCH'&&row.domain!=='MARKETS')continue;
   const x=shock(row,d,scenario.id);
   const stateDrop=Math.max(0,stateRank[d.state]-stateRank[x.stressedState]);
   scenarioResults.push({scenarioId:scenario.id,stressedScore:x.stressedScore,stressedState:x.stressedState,scoreDelta:x.stressedScore-d.actionabilityScore,stateDrop,edgeAfter:x.edgeAfter,confidenceAfter:x.confidenceAfter,survivesPriority:stateRank[x.stressedState]>=stateRank['WATCH'],reasons:x.reasons});
  }
  const worst=[...scenarioResults].sort((a,b)=>a.stressedScore-b.stressedScore)[0];
  const survivalRate=scenarioResults.length?scenarioResults.filter(x=>x.survivesPriority).length/scenarioResults.length:0;
  const averageRetention=scenarioResults.length?scenarioResults.reduce((s,x)=>s+clamp(x.stressedScore/Math.max(.01,d.actionabilityScore)),0)/scenarioResults.length:0;
  const robustnessScore=clamp(survivalRate*.55+averageRetention*.30+(1-(worst?.stateDrop??4)/4)*.15);
  const classification=robustnessScore>=.82?'ROBUST':robustnessScore>=.66?'RESILIENT':robustnessScore>=.45?'FRAGILE':'FAIL';
  rows.push({id:row.id,domain:row.domain,category:row.category,venue:row.venue,title:row.title,baselineState:d.state,baselineScore:d.actionabilityScore,baselineEdge:row.edge,baselineConfidence:d.confidence,scenarioResults,robustnessScore,survivalRate,worstScenario:worst.scenarioId,worstScore:worst.stressedScore,worstState:worst.stressedState,classification});
 }
 rows.sort((a,b)=>b.robustnessScore-a.robustnessScore||b.baselineScore-a.baselineScore);
 return {generatedAt:new Date().toISOString(),scenarios:STRESS_SCENARIOS,rows,summary:{robust:rows.filter(x=>x.classification==='ROBUST').length,resilient:rows.filter(x=>x.classification==='RESILIENT').length,fragile:rows.filter(x=>x.classification==='FRAGILE').length,fail:rows.filter(x=>x.classification==='FAIL').length,primeReadyFragile:rows.filter(x=>(x.baselineState==='PRIME'||x.baselineState==='READY')&&(x.classification==='FRAGILE'||x.classification==='FAIL')).length},notes:['Stress tests are deterministic sensitivity scenarios, not forecasts of what will happen.','A PRIME/READY opportunity that becomes FRAGILE under plausible shocks should receive extra review before relying on it.','Stress testing is analytics-only and never submits wagers, trades, cash-outs, or orders.']};
}

export async function persistStressScenarioLab(rows:StressOpportunityRow[]){
 const sql=db();if(!sql||!rows.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from stress_scenario_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<15*60000)return {persisted:false};
 for(const x of rows){
  await sql`insert into stress_scenario_snapshots(observed_at,opportunity_id,domain,category,venue,baseline_state,baseline_score,robustness_score,survival_rate,worst_scenario,worst_score,worst_state,classification,scenario_results) values(now(),${x.id},${x.domain},${x.category},${x.venue},${x.baselineState},${x.baselineScore},${x.robustnessScore},${x.survivalRate},${x.worstScenario},${x.worstScore},${x.worstState},${x.classification},${sql.json(x.scenarioResults as any)})`;
 }
 return {persisted:true};
}