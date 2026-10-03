import type {Scanned} from './scanner';
import {correlationExposure} from './sameGameCorrelation';
import {runEventJointSimulation,type JointSimulationResult} from './eventJointSimulation';
import type {LearnedSgpMap} from './learnedSgpCorrelation';
import {decimalOdds,fairAmerican} from './math';

export type ParlayQualification='STRICT'|'WATCH_FALLBACK';
export type ParlayTier='RECOMMENDED'|'VALUE_WATCHLIST'|'HAIL_MARY'|'REJECTED';
export type ParlayRiskFlag=
 |'WATCH_FALLBACK'
 |'LOW_JOINT_PROBABILITY'
 |'LOW_LEG_PROBABILITY'
 |'LOW_DYNAMIC_CONFIDENCE'
 |'VOLATILE_REGIME'
 |'DISLOCATED_REGIME'
 |'CONTEXT_LIMITED'
 |'MODEL_SIM_DIVERGENCE'
 |'EXTREME_UNDERDOG'
 |'LONGSHOT_PAYOUT'
 |'THIN_CONSENSUS'
 |'AGING_DATA'
 |'NEGATIVE_EXPECTED_VALUE';

export type ParlayThresholds={
 recommendedMinJoint:number;
 recommendedMinLeg:number;
 recommendedMinConfidence:number;
 recommendedMaxModelSimulationGap:number;
 recommendedMinContextCoverage:number;
 valueMinJoint:number;
 extremeUnderdogOdds:number;
 hailMaryCombinedOdds:number;
};

export const DEFAULT_PARLAY_THRESHOLDS:ParlayThresholds={
 recommendedMinJoint:.52,
 recommendedMinLeg:.60,
 recommendedMinConfidence:.58,
 recommendedMaxModelSimulationGap:.15,
 recommendedMinContextCoverage:.50,
 valueMinJoint:.25,
 extremeUnderdogOdds:400,
 hailMaryCombinedOdds:1000
};

export type Parlay={
 id:string;
 qualification:ParlayQualification;
 tier:ParlayTier;
 recommendationEligible:boolean;
 reasons:string[];
 riskFlags:ParlayRiskFlag[];
 legs:Scanned[];
 combinedProbability:number;
 independentProbability:number;
 correlationPenalty:number;
 correlationDelta:number;
 jointSimulationRuns:number;
 jointCi:[number,number];
 eventCount:number;
 sameEventPairCount:number;
 learnedPairCount:number;
 matrixShrink:number;
 jointEngine:JointSimulationResult['engine'];
 scenarioCoverage:number;
 combinedDecimalOdds:number;
 combinedAmericanOdds:number;
 fairParlayOdds:number;
 expectedValue:number;
 minLegProbability:number;
 averageDynamicConfidence:number;
 contextCoverage:number;
 maxModelSimulationGap:number;
 extremeUnderdogCount:number;
 score:number;
 label:string;
 pairCorrelations:JointSimulationResult['pairCorrelations'];
};

export type ParlayBoards={
 thresholds:ParlayThresholds;
 generated:number;
 rejected:number;
 recommended:Parlay[];
 valueWatchlist:Parlay[];
 hailMary:Parlay[];
};

function correlation(a:Scanned,b:Scanned){return correlationExposure(a,b)}

function runCount(size:number){
 if(size<=3)return 10000;
 if(size<=6)return 5000;
 if(size<=10)return 3000;
 return 1500;
}

function americanFromDecimal(decimal:number){
 const profit=Math.max(.000001,decimal-1);
 return profit>=1?Math.round(profit*100):Math.round(-100/profit);
}

function hasContext(row:Scanned){
 return Boolean(
  row.playerContext ||
  (row.contextSources?.length||0)>0 ||
  Object.keys(row.sportFeatures||{}).length>0
 );
}

function uniqueFlags(flags:ParlayRiskFlag[]){
 return [...new Set(flags)];
}

function tierParlay(
 picks:Scanned[],
 qualification:ParlayQualification,
 combinedProbability:number,
 combinedAmericanOdds:number,
 expectedValue:number,
 thresholds:ParlayThresholds
){
 const minLegProbability=Math.min(...picks.map(x=>x.simProbability));
 const averageDynamicConfidence=picks.reduce((s,x)=>s+(x.dynamicConfidence??x.confidence),0)/Math.max(1,picks.length);
 const contextCoverage=picks.filter(hasContext).length/Math.max(1,picks.length);
 const maxModelSimulationGap=Math.max(...picks.map(x=>Math.abs(x.simProbability-x.modelProb)));
 const extremeUnderdogCount=picks.filter(x=>x.odds>=thresholds.extremeUnderdogOdds).length;
 const flags:ParlayRiskFlag[]=[];

 if(qualification==='WATCH_FALLBACK')flags.push('WATCH_FALLBACK');
 if(combinedProbability<thresholds.recommendedMinJoint)flags.push('LOW_JOINT_PROBABILITY');
 if(minLegProbability<thresholds.recommendedMinLeg)flags.push('LOW_LEG_PROBABILITY');
 if(averageDynamicConfidence<thresholds.recommendedMinConfidence)flags.push('LOW_DYNAMIC_CONFIDENCE');
 if(picks.some(x=>x.regime==='VOLATILE'))flags.push('VOLATILE_REGIME');
 if(picks.some(x=>x.regime==='DISLOCATED'))flags.push('DISLOCATED_REGIME');
 if(contextCoverage<thresholds.recommendedMinContextCoverage)flags.push('CONTEXT_LIMITED');
 if(maxModelSimulationGap>thresholds.recommendedMaxModelSimulationGap)flags.push('MODEL_SIM_DIVERGENCE');
 if(extremeUnderdogCount>0)flags.push('EXTREME_UNDERDOG');
 if(combinedAmericanOdds>=thresholds.hailMaryCombinedOdds)flags.push('LONGSHOT_PAYOUT');
 if(picks.some(x=>(x.consensus?.bookCount??1)<2))flags.push('THIN_CONSENSUS');
 if(picks.some(x=>x.freshness!=='FRESH'))flags.push('AGING_DATA');
 if(expectedValue<=0)flags.push('NEGATIVE_EXPECTED_VALUE');

 const blocking:ParlayRiskFlag[]=[
  'WATCH_FALLBACK','LOW_JOINT_PROBABILITY','LOW_LEG_PROBABILITY','LOW_DYNAMIC_CONFIDENCE',
  'DISLOCATED_REGIME','CONTEXT_LIMITED','MODEL_SIM_DIVERGENCE','EXTREME_UNDERDOG',
  'LONGSHOT_PAYOUT','THIN_CONSENSUS','AGING_DATA'
 ];
 const recommendationEligible=qualification==='STRICT'&&!flags.some(x=>blocking.includes(x));

 const hailMary=
  combinedProbability<thresholds.valueMinJoint ||
  extremeUnderdogCount>0 ||
  combinedAmericanOdds>=thresholds.hailMaryCombinedOdds ||
  maxModelSimulationGap>.25;

 const tier:ParlayTier=expectedValue<=0?'REJECTED':recommendationEligible?'RECOMMENDED':hailMary?'HAIL_MARY':'VALUE_WATCHLIST';
 const reasons:string[]=[];

 if(tier==='RECOMMENDED'){
  reasons.push(
   `joint simulation ${(combinedProbability*100).toFixed(1)}% meets ${(thresholds.recommendedMinJoint*100).toFixed(0)}% recommendation floor`,
   `all legs clear the ${(thresholds.recommendedMinLeg*100).toFixed(0)}% simulation floor`,
   'context, confidence and market-model agreement gates passed'
  );
 }else if(tier==='VALUE_WATCHLIST'){
  reasons.push('positive model value is present, but one or more recommendation gates are not yet cleared');
 }else if(tier==='HAIL_MARY'){
  reasons.push('kept outside normal recommendations because payout/probability/model-risk profile is longshot grade');
 }else{
  reasons.push('excluded from recommendation boards because modeled parlay expected value is not positive');
 }

 if(flags.includes('CONTEXT_LIMITED'))reasons.push(`context coverage is ${Math.round(contextCoverage*100)}%`);
 if(flags.includes('MODEL_SIM_DIVERGENCE'))reasons.push(`largest model-vs-simulation gap is ${(maxModelSimulationGap*100).toFixed(1)} points`);
 if(flags.includes('EXTREME_UNDERDOG'))reasons.push(`${extremeUnderdogCount} leg(s) are +${thresholds.extremeUnderdogOdds} or longer`);
 if(flags.includes('LOW_DYNAMIC_CONFIDENCE'))reasons.push(`average dynamic confidence is ${(averageDynamicConfidence*100).toFixed(1)}%`);

 return {
  tier,recommendationEligible,reasons,riskFlags:uniqueFlags(flags),
  minLegProbability,averageDynamicConfidence,contextCoverage,maxModelSimulationGap,extremeUnderdogCount
 };
}

function summarize(
 picks:Scanned[],
 label:string,
 learned?:LearnedSgpMap,
 qualification:ParlayQualification='STRICT',
 thresholds:ParlayThresholds=DEFAULT_PARLAY_THRESHOLDS
):Parlay{
 const joint=runEventJointSimulation(picks,learned,runCount(picks.length));
 const independent=joint.independentProbability;
 const adjusted=joint.probability;
 let penalty=0;
 for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++)penalty+=correlation(picks[i],picks[j]);
 const cappedPenalty=Math.min(.55,penalty);
 const agreement=picks.reduce((s,x)=>s+x.agreement,0)/Math.max(1,picks.length);
 const freshness=picks.reduce((s,x)=>s+(x.freshness==='FRESH'?1:x.freshness==='AGING'?.7:.35),0)/Math.max(1,picks.length);
 const combinedDecimalOdds=picks.reduce((p,x)=>p*decimalOdds(x.odds),1);
 const combinedAmericanOdds=americanFromDecimal(combinedDecimalOdds);
 const fairParlayOdds=fairAmerican(adjusted);
 const expectedValue=adjusted*(combinedDecimalOdds-1)-(1-adjusted);
 const tiered=tierParlay(picks,qualification,adjusted,combinedAmericanOdds,expectedValue,thresholds);
 const tierBonus=tiered.tier==='RECOMMENDED'?.08:tiered.tier==='VALUE_WATCHLIST'?.02:-.04;
 const riskPenalty=Math.min(.18,tiered.riskFlags.length*.018);
 const score=adjusted*.62+agreement*.14+freshness*.08+tiered.averageDynamicConfidence*.08+tiered.contextCoverage*.08+tierBonus-riskPenalty;
 return {
  id:picks.map(x=>x.id).join('-'),
  qualification,
  tier:tiered.tier,
  recommendationEligible:tiered.recommendationEligible,
  reasons:tiered.reasons,
  riskFlags:tiered.riskFlags,
  legs:[...picks],
  combinedProbability:adjusted,
  independentProbability:independent,
  correlationPenalty:cappedPenalty,
  correlationDelta:joint.correlationDelta,
  jointSimulationRuns:joint.runs,
  jointCi:[joint.ciLow,joint.ciHigh],
  eventCount:joint.eventCount,
  sameEventPairCount:joint.pairCorrelations.filter(x=>x.sameEvent).length,
  learnedPairCount:joint.pairCorrelations.filter(x=>x.learnedSample>0).length,
  matrixShrink:joint.matrixShrink,
  jointEngine:joint.engine,
  scenarioCoverage:joint.scenarioCoverage,
  combinedDecimalOdds,
  combinedAmericanOdds,
  fairParlayOdds,
  expectedValue,
  minLegProbability:tiered.minLegProbability,
  averageDynamicConfidence:tiered.averageDynamicConfidence,
  contextCoverage:tiered.contextCoverage,
  maxModelSimulationGap:tiered.maxModelSimulationGap,
  extremeUnderdogCount:tiered.extremeUnderdogCount,
  pairCorrelations:joint.pairCorrelations,
  score,
  label
 };
}

export function selectParlayPool(rows:Scanned[],size:2|3){
 const strict=rows
  .filter(x=>x.grade==='ELITE'||x.grade==='STRONG')
  .sort((a,b)=>b.simProbability-a.simProbability||b.expectedValue-a.expectedValue)
  .slice(0,16);
 const watch=rows
  .filter(x=>x.grade==='WATCH'&&x.expectedValue>0&&x.freshness!=='STALE'&&(x.dynamicConfidence??x.confidence)>=.40)
  .sort((a,b)=>b.simProbability-a.simProbability||b.expectedValue-a.expectedValue);

 if(strict.length>=size)return {
  pool:strict,
  qualification:'STRICT' as const,
  strictCount:strict.length,
  watchCount:watch.length,
  fallbackUsed:false
 };

 const seen=new Set(strict.map(x=>x.id));
 const pool=[...strict,...watch.filter(x=>!seen.has(x.id))].slice(0,16);
 return {
  pool,
  qualification:'WATCH_FALLBACK' as const,
  strictCount:strict.length,
  watchCount:watch.length,
  fallbackUsed:pool.length>=size
 };
}

export function buildParlays(
 rows:Scanned[],
 size:2|3,
 learned?:LearnedSgpMap,
 thresholds:ParlayThresholds=DEFAULT_PARLAY_THRESHOLDS
):Parlay[]{
 const selected=selectParlayPool(rows,size);
 const qualified=selected.pool;
 const out:Parlay[]=[];
 const visit=(start:number,picks:Scanned[])=>{
  if(picks.length===size){
   const label=selected.qualification==='STRICT'
    ?(size===2?'2-LEG STRICT':'3-LEG STRICT')
    :(size===2?'2-LEG WATCHLIST':'3-LEG WATCHLIST');
   out.push(summarize(picks,label,learned,selected.qualification,thresholds));
   return;
  }
  for(let i=start;i<qualified.length;i++)visit(i+1,[...picks,qualified[i]]);
 };
 visit(0,[]);
 return out.sort((a,b)=>b.score-a.score||b.combinedProbability-a.combinedProbability).slice(0,40);
}

export function buildParlayBoards(
 rows:Scanned[],
 size:2|3,
 learned?:LearnedSgpMap,
 overrides:Partial<ParlayThresholds>={}
):ParlayBoards{
 const thresholds={...DEFAULT_PARLAY_THRESHOLDS,...overrides};
 const all=buildParlays(rows,size,learned,thresholds);
 const recommended=all
  .filter(x=>x.tier==='RECOMMENDED')
  .sort((a,b)=>b.combinedProbability-a.combinedProbability||b.score-a.score)
  .slice(0,10);
 const valueWatchlist=all
  .filter(x=>x.tier==='VALUE_WATCHLIST')
  .sort((a,b)=>b.combinedProbability-a.combinedProbability||b.expectedValue-a.expectedValue)
  .slice(0,10);
 const hailMary=all
  .filter(x=>x.tier==='HAIL_MARY')
  .sort((a,b)=>b.combinedProbability-a.combinedProbability||b.expectedValue-a.expectedValue)
  .slice(0,10);
 const rejected=all.filter(x=>x.tier==='REJECTED').length;
 return {thresholds,generated:all.length,rejected,recommended,valueWatchlist,hailMary};
}

export function buildProbabilitySet(rows:Scanned[],size:number,learned?:LearnedSgpMap):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const pool=[...rows]
  .filter(x=>x.grade!=='PASS')
  .sort((a,b)=>b.simProbability-a.simProbability||b.agreement-a.agreement)
  .slice(0,60);

 if(pool.length<target)return null;

 const picks:Scanned[]=[];
 const used=new Set<string>();

 while(picks.length<target){
  let best:Scanned|null=null;
  let bestScore=-Infinity;

  for(const candidate of pool){
   if(used.has(candidate.id))continue;
   const corr=picks.reduce((s,x)=>s+correlation(x,candidate),0);
   const freshness=candidate.freshness==='FRESH'?1:candidate.freshness==='AGING'?.72:.35;
   const marketPreference=candidate.market.toLowerCase().includes('money')?.025:0;
   const localScore=candidate.simProbability*.72+candidate.agreement*.18+freshness*.10+marketPreference-corr*.35;
   if(localScore>bestScore){bestScore=localScore;best=candidate}
  }

  if(!best)break;
  picks.push(best);
  used.add(best.id);
 }

 return picks.length===target?summarize(picks,target+'-LEG PROBABILITY SET',learned):null;
}

export function buildSportProbabilitySet(rows:Scanned[],sport:string,size:number,learned?:LearnedSgpMap){
 return buildProbabilitySet(rows.filter(x=>x.sport===sport),size,learned);
}

export function buildMixedSportProbabilitySet(rows:Scanned[],size:number,learned?:LearnedSgpMap):Parlay|null{
 const target=Math.max(2,Math.min(20,Math.round(size)));
 const bySport=new Map<string,Scanned[]>();
 for(const row of rows.filter(x=>x.grade!=='PASS').sort((a,b)=>b.simProbability-a.simProbability)){
  bySport.set(row.sport,[...(bySport.get(row.sport)||[]),row]);
 }
 const sports=[...bySport.keys()];
 if(!sports.length)return null;
 const seed:Scanned[]=[];
 let cursor=0;
 while(seed.length<target&&cursor<target*10){
  const sport=sports[cursor%sports.length];
  const bucket=bySport.get(sport)||[];
  const candidate=bucket.find(x=>!seed.some(s=>s.id===x.id));
  if(candidate)seed.push(candidate);
  cursor++;
  if(seed.length>=rows.length)break;
 }
 if(seed.length<target)return buildProbabilitySet(rows,target,learned);
 return summarize(seed.slice(0,target),target+'-LEG MULTI-SPORT SET',learned);
}
