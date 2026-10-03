import type {Market} from './types';
import {modelCouncil} from './modelCouncil';
import type {LearnedWeightMap} from './learnedWeights';

export type DriverDirection='SUPPORTS'|'OPPOSES'|'NEUTRAL';
export type FragilityLabel='ROBUST'|'MODERATE'|'FRAGILE';

export type ModelContribution={
 name:string;
 probability:number;
 normalizedWeight:number;
 contribution:number;
 direction:DriverDirection;
};

export type ComponentAblation={
 name:string;
 baselineProbability:number;
 withoutProbability:number;
 delta:number;
 direction:DriverDirection;
};

export type FeatureAblation={
 feature:string;
 value:number;
 baselineProbability:number;
 zeroedProbability:number;
 delta:number;
 sensitivityPerUnit:number;
 direction:DriverDirection;
};

export type ExplainabilityResult={
 baselineProbability:number;
 marketProbability:number;
 edge:number;
 contributionReconstruction:number;
 contributionError:number;
 modelContributions:ModelContribution[];
 componentAblations:ComponentAblation[];
 featureAblations:FeatureAblation[];
 diagnostics:{
  councilAgreement:number;
  councilDispersion:number;
  weightConcentration:number;
  effectiveModelCount:number;
  dominantModel:string;
  dominantWeight:number;
  maxComponentAblation:number;
  maxFeatureAblation:number;
  fragilityRatio:number;
  fragility:FragilityLabel;
  activeFeatureCount:number;
 };
 topDrivers:Array<{
  kind:'MODEL'|'FEATURE';
  name:string;
  impact:number;
  direction:DriverDirection;
 }>;
 summary:string[];
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const direction=(x:number):DriverDirection=>Math.abs(x)<.0005?'NEUTRAL':x>0?'SUPPORTS':'OPPOSES';

function withoutVoteProbability(votes:ReturnType<typeof modelCouncil>['votes'],skip:number){
 let total=0,weighted=0;
 for(let i=0;i<votes.length;i++){
  if(i===skip)continue;
  total+=votes[i].weight;
  weighted+=votes[i].prob*votes[i].weight;
 }
 return total?weighted/total:.5;
}

function activeFeatures(m:Market){
 return Object.entries(m.sportFeatures||{})
  .filter(([,value])=>Number.isFinite(Number(value))&&Math.abs(Number(value))>=.005)
  .map(([feature,value])=>({feature,value:clamp(Number(value),-1,1)}));
}

export function applyFeatureScenario(
 m:Market,
 overrides:Record<string,number>={},
 deltas:Record<string,number>={}
):Market{
 const features={...(m.sportFeatures||{})};
 for(const [key,value] of Object.entries(overrides)){
  if(Number.isFinite(Number(value)))features[key]=clamp(Number(value),-1,1);
 }
 for(const [key,value] of Object.entries(deltas)){
  if(!Number.isFinite(Number(value)))continue;
  features[key]=clamp(Number(features[key]||0)+Number(value),-1,1);
 }
 return {...m,sportFeatures:features};
}

export function explainMarket(m:Market,learnedWeights?:LearnedWeightMap):ExplainabilityResult{
 const council=modelCouncil(m,learnedWeights);
 const totalWeight=council.votes.reduce((s,v)=>s+v.weight,0)||1;
 const anchor=m.marketProb;

 const modelContributions:ModelContribution[]=council.votes.map(v=>{
  const normalizedWeight=v.weight/totalWeight;
  const contribution=normalizedWeight*(v.prob-anchor);
  return {
   name:v.name,
   probability:v.prob,
   normalizedWeight,
   contribution,
   direction:direction(contribution)
  };
 }).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution));

 const contributionReconstruction=anchor+modelContributions.reduce((s,x)=>s+x.contribution,0);
 const contributionError=contributionReconstruction-council.ensemble;

 const componentAblations:ComponentAblation[]=council.votes.map((v,index)=>{
  const withoutProbability=withoutVoteProbability(council.votes,index);
  const delta=council.ensemble-withoutProbability;
  return {
   name:v.name,
   baselineProbability:council.ensemble,
   withoutProbability,
   delta,
   direction:direction(delta)
  };
 }).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));

 const featureAblations:FeatureAblation[]=activeFeatures(m).map(({feature,value})=>{
  const zeroed=modelCouncil({
   ...m,
   sportFeatures:{...(m.sportFeatures||{}),[feature]:0}
  },learnedWeights).ensemble;

  const step=.15;
  const plusValue=clamp(value+step,-1,1);
  const minusValue=clamp(value-step,-1,1);
  const plus=modelCouncil({
   ...m,
   sportFeatures:{...(m.sportFeatures||{}),[feature]:plusValue}
  },learnedWeights).ensemble;
  const minus=modelCouncil({
   ...m,
   sportFeatures:{...(m.sportFeatures||{}),[feature]:minusValue}
  },learnedWeights).ensemble;
  const span=plusValue-minusValue;
  const sensitivityPerUnit=span?((plus-minus)/span):0;
  const delta=council.ensemble-zeroed;
  return {
   feature,value,
   baselineProbability:council.ensemble,
   zeroedProbability:zeroed,
   delta,
   sensitivityPerUnit,
   direction:direction(delta)
  };
 }).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));

 const weights=council.votes.map(v=>v.weight/totalWeight);
 const weightConcentration=weights.reduce((s,w)=>s+w*w,0);
 const effectiveModelCount=weightConcentration?1/weightConcentration:0;
 const dominantIndex=weights.reduce((best,w,i)=>w>(weights[best]??-1)?i:best,0);
 const dominantModel=council.votes[dominantIndex]?.name||'—';
 const dominantWeight=weights[dominantIndex]||0;
 const maxComponentAblation=componentAblations.reduce((m,x)=>Math.max(m,Math.abs(x.delta)),0);
 const maxFeatureAblation=featureAblations.reduce((m,x)=>Math.max(m,Math.abs(x.delta)),0);
 const edge=council.ensemble-anchor;
 const fragilityRatio=Math.max(maxComponentAblation,maxFeatureAblation)/Math.max(.005,Math.abs(edge));
 const fragility:FragilityLabel=fragilityRatio>=.75?'FRAGILE':fragilityRatio>=.40?'MODERATE':'ROBUST';

 const topDrivers=[
  ...modelContributions.map(x=>({kind:'MODEL' as const,name:x.name,impact:x.contribution,direction:x.direction})),
  ...featureAblations.map(x=>({kind:'FEATURE' as const,name:x.feature,impact:x.delta,direction:x.direction}))
 ].sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,10);

 const pp=(x:number)=>(Math.abs(x)*100).toFixed(1);
 const side=edge>=0?'above':'below';
 const topSupport=topDrivers.find(x=>x.impact>.0005);
 const topOppose=topDrivers.find(x=>x.impact<-.0005);
 const summary=[
  `Ensemble probability is ${pp(edge)} points ${side} the market baseline.`,
  topSupport?`Largest supporting driver: ${topSupport.name} (+${pp(topSupport.impact)} points).`:'No material positive driver dominates.',
  topOppose?`Largest opposing driver: ${topOppose.name} (-${pp(topOppose.impact)} points).`:'No material opposing driver dominates.',
  `Council agreement is ${(council.agreement*100).toFixed(0)}%; explanation fragility is ${fragility.toLowerCase()}.`
 ];

 return {
  baselineProbability:council.ensemble,
  marketProbability:anchor,
  edge,
  contributionReconstruction,
  contributionError,
  modelContributions,
  componentAblations,
  featureAblations,
  diagnostics:{
   councilAgreement:council.agreement,
   councilDispersion:council.dispersion,
   weightConcentration,
   effectiveModelCount,
   dominantModel,
   dominantWeight,
   maxComponentAblation,
   maxFeatureAblation,
   fragilityRatio,
   fragility,
   activeFeatureCount:featureAblations.length
  },
  topDrivers,
  summary
 };
}
