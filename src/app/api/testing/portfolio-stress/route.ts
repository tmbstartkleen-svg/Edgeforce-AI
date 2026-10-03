import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';
import type {Scanned} from '@/lib/scanner';

export const dynamic='force-dynamic';

function leg(id:string,sport:string,event:string,p:number,odds:number):Scanned{
 return {
  id,sport,league:sport,event,selection:id,market:'moneyline',
  startTime:new Date(Date.now()+3600000).toISOString(),home:'Home',away:'Away',
  odds,marketProb:.52,modelProb:p,confidence:.85,sourceAgeMin:2,period:'PM',
  fairOdds:-120,edge:p-.52,expectedValue:.08,kelly:.05,recommendedStake:.022,
  agreement:.88,sportModelProbability:p,sportAdjustment:0,sportFactors:[],grade:'STRONG',
  simulationRuns:10000,rawSimProbability:p,simProbability:p,simCi:[p-.02,p+.02],
  dynamicConfidence:.84,uncertainty:.16,confidenceLabel:'HIGH',regime:'STABLE',
  historicalShrinkage:.02,consensusBlend:.08,
  dynamicConfidenceComponents:{
   sourceQuality:.9,modelAgreement:.88,simulationPrecision:.9,consensusAgreement:.9,
   distributionConfidence:.85,historicalReliability:.82,regimeMultiplier:1
  },
  daysOut:.2,bucket:'TODAY',freshness:'FRESH',simEngine:'TEST',simProjection:{},
  consensus:{
   providerCount:3,bookCount:3,targetBook:'DraftKings',targetBookFound:true,
   consensusProbability:.52,consensusFairOdds:-108,dispersion:.01,agreement:.9,
   minProbability:.50,maxProbability:.54,bestOdds:odds,bestBook:'DraftKings',
   marketStructure:'ALIGNED',outlierBooks:[],books:['DraftKings','Book B','Book C']
  }
 } as Scanned;
}

export async function GET(){
 const rows=[
  leg('a','NFL','A @ B',.66,-110),
  leg('b','NBA','C @ D',.64,-105),
  leg('c','NHL','E @ F',.63,105),
  leg('d','MLB','G @ H',.62,110)
 ];
 const limits={...defaultLimits(1000),stressRuns:600,maxStressCvarPct:.06};
 const normal=optimizePortfolio(rows,limits,0);
 const drawdown=optimizePortfolio(rows,limits,.16);
 const ok=
  normal.stress.scenarios.length===5
  &&normal.stress.worstScenario.cvar95Loss>=0
  &&normal.stressScale<=1
  &&normal.drawdownBrake===1
  &&drawdown.drawdownBrake<normal.drawdownBrake
  &&drawdown.totalStake<normal.totalStake;
 return Response.json({ok,normal:{
  totalStake:normal.totalStake,drawdownBrake:normal.drawdownBrake,stressScale:normal.stressScale,
  worstScenario:normal.stress.worstScenario
 },drawdown:{
  totalStake:drawdown.totalStake,drawdownBrake:drawdown.drawdownBrake,stressScale:drawdown.stressScale,
  worstScenario:drawdown.stress.worstScenario
 }});
}
