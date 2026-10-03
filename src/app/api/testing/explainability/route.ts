import {demoMarkets} from '@/lib/demo';
import {applyFeatureScenario,explainMarket} from '@/lib/explainability';

export const dynamic='force-dynamic';

export async function GET(){
 const market=demoMarkets.find(x=>x.id==='demo-mlb')||demoMarkets[0];
 const baseline=explainMarket(market);
 const scenarioMarket=applyFeatureScenario(market,{}, {starter:.20,weather:-.15});
 const scenario=explainMarket(scenarioMarket);
 const reconstructed=Math.abs(baseline.contributionError)<1e-10;
 const componentCoverage=baseline.componentAblations.length===10;
 const featureCoverage=baseline.featureAblations.length>0;
 const scenarioMoved=Math.abs(scenario.baselineProbability-baseline.baselineProbability)>.0001;
 const ok=reconstructed&&componentCoverage&&featureCoverage&&scenarioMoved;
 return Response.json({
  ok,
  reconstructed,
  componentCoverage,
  featureCoverage,
  scenarioMoved,
  baseline:{
   probability:baseline.baselineProbability,
   contributionError:baseline.contributionError,
   fragility:baseline.diagnostics.fragility,
   topDrivers:baseline.topDrivers.slice(0,5)
  },
  scenario:{
   probability:scenario.baselineProbability,
   delta:scenario.baselineProbability-baseline.baselineProbability,
   fragility:scenario.diagnostics.fragility,
   topDrivers:scenario.topDrivers.slice(0,5)
  }
 });
}
