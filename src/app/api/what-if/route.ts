import {demoMarkets} from '@/lib/demo';
import {repriceMarket,type RepriceContext} from '@/lib/repricing';
import {scanMarkets} from '@/lib/scanner';
import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';
import {applyFeatureScenario,explainMarket} from '@/lib/explainability';
import {latestStoredMarkets} from '@/lib/persistence';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import type {Market,RiskProfile} from '@/lib/types';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const numericMap=(value:unknown)=>{
 const out:Record<string,number>={};
 if(!value||typeof value!=='object'||Array.isArray(value))return out;
 for(const [key,raw] of Object.entries(value as Record<string,unknown>)){
  const n=Number(raw);
  if(Number.isFinite(n))out[key]=n;
 }
 return out;
};

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const [stored,learnedWeights,dynamicCalibration]=await Promise.all([
  latestStoredMarkets(1000).catch(()=>[]),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);
 const requested=body?.market as Market|undefined;
 const market=requested
  ||stored.find(x=>x.id===body?.marketId)
  ||demoMarkets.find(x=>x.id===body?.marketId)
  ||demoMarkets[0];

 const risk:RiskProfile=body?.risk==='Conservative'||body?.risk==='Aggressive'?body.risk:'Moderate';
 const context=(body?.context||{}) as RepriceContext;
 let scenario=applyFeatureScenario(
  repriceMarket(market,context),
  numericMap(body?.featureOverrides),
  numericMap(body?.featureDeltas)
 );
 const modelProbabilityDelta=Number(body?.modelProbabilityDelta);
 const marketProbabilityDelta=Number(body?.marketProbabilityDelta);
 if(Number.isFinite(modelProbabilityDelta)){
  scenario={...scenario,modelProb:clamp(scenario.modelProb+modelProbabilityDelta,.01,.99)};
 }
 if(Number.isFinite(marketProbabilityDelta)){
  scenario={...scenario,marketProb:clamp(scenario.marketProb+marketProbabilityDelta,.01,.99)};
 }

 const originalScan=scanMarkets([market],risk,new Date(),learnedWeights,dynamicCalibration)[0]||null;
 const scenarioScan=scanMarkets([scenario],risk,new Date(),learnedWeights,dynamicCalibration)[0]||null;
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 const portfolio=optimizePortfolio(scenarioScan?[scenarioScan]:[],limits,Math.max(0,Math.min(1,Number(body?.drawdownPct)||0)));
 const originalExplanation=explainMarket(market,learnedWeights);
 const scenarioExplanation=explainMarket(scenario,learnedWeights);

 return Response.json({
  readOnly:true,
  source:stored.some(x=>x.id===market.id)?'database':'demo-or-request',
  original:market,
  scenario,
  originalScan,
  scenarioScan,
  originalExplanation,
  scenarioExplanation,
  delta:{
   modelProbability:scenario.modelProb-market.modelProb,
   ensembleProbability:scenarioExplanation.baselineProbability-originalExplanation.baselineProbability,
   simulationProbability:(scenarioScan?.simProbability??0)-(originalScan?.simProbability??0),
   dynamicConfidence:(scenarioScan?.dynamicConfidence??0)-(originalScan?.dynamicConfidence??0),
   recommendedStake:(scenarioScan?.recommendedStake??0)-(originalScan?.recommendedStake??0),
   grade:{before:originalScan?.grade??null,after:scenarioScan?.grade??null},
   regime:{before:originalScan?.regime??null,after:scenarioScan?.regime??null},
   fragility:{before:originalExplanation.diagnostics.fragility,after:scenarioExplanation.diagnostics.fragility}
  },
  applied:{
   context,
   featureOverrides:numericMap(body?.featureOverrides),
   featureDeltas:numericMap(body?.featureDeltas),
   modelProbabilityDelta:Number.isFinite(modelProbabilityDelta)?modelProbabilityDelta:0,
   marketProbabilityDelta:Number.isFinite(marketProbabilityDelta)?marketProbabilityDelta:0
  },
  portfolio
 });
}
