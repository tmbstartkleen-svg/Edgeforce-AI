import {assessParlayTier,DEFAULT_PARLAY_THRESHOLDS} from '@/lib/parlays';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const base={
  id:'test',sport:'NFL',league:'NFL',event:'Away @ Home',selection:'Home',market:'h2h',
  startTime:new Date(Date.now()+3600000).toISOString(),home:'Home',away:'Away',odds:-200,
  marketProb:.66,modelProb:.74,confidence:.82,sourceAgeMin:1,period:'PM',
  fairOdds:-285,edge:.08,expectedValue:.11,kelly:.12,recommendedStake:.02,agreement:.88,
  sportModelProbability:.74,sportAdjustment:.02,sportFactors:['qb'],modelVotes:[],grade:'ELITE',
  simulationRuns:10000,rawSimProbability:.78,simProbability:.78,simCi:[.76,.80],
  dynamicConfidence:.80,uncertainty:.20,confidenceLabel:'HIGH',regime:'STABLE',
  historicalShrinkage:0,consensusBlend:.5,dynamicConfidenceComponents:{},daysOut:.2,bucket:'TODAY',
  freshness:'FRESH',simEngine:'TEST',simProjection:{distributionConfidence:.9},
  sportFeatures:{quarterback:.8},contextSources:['test'],
  consensus:{providerCount:2,bookCount:3,targetBook:'DraftKings',targetBookFound:true,
   consensusProbability:.66,consensusFairOdds:-194,dispersion:.01,agreement:.9,minProbability:.64,
   maxProbability:.68,bestOdds:-190,bestBook:'DraftKings',marketStructure:'ALIGNED',
   outlierBooks:[],books:['DraftKings','FanDuel','BetMGM']}
 } as any;

 const recommended=assessParlayTier(
  [{...base,id:'a'},{...base,id:'b'}] as any,
  'STRICT',.61,-110,.12,DEFAULT_PARLAY_THRESHOLDS
 );

 const value=assessParlayTier(
  [{...base,id:'c',grade:'WATCH',simProbability:.64,modelProb:.60,dynamicConfidence:.66}] as any,
  'WATCH_FALLBACK',.35,250,.08,DEFAULT_PARLAY_THRESHOLDS
 );

 const hail=assessParlayTier(
  [{...base,id:'d',odds:1200,grade:'WATCH',simProbability:.32,modelProb:.18,dynamicConfidence:.55}] as any,
  'WATCH_FALLBACK',.12,1800,.30,DEFAULT_PARLAY_THRESHOLDS
 );

 const rejected=assessParlayTier(
  [{...base,id:'e'}] as any,
  'STRICT',.55,-105,-.04,DEFAULT_PARLAY_THRESHOLDS
 );

 const ok=
  recommended.tier==='RECOMMENDED'&&recommended.recommendationEligible===true&&
  value.tier==='VALUE_WATCHLIST'&&value.recommendationEligible===false&&
  hail.tier==='HAIL_MARY'&&hail.riskFlags.includes('LONGSHOT_PAYOUT')&&
  rejected.tier==='REJECTED'&&rejected.riskFlags.includes('NEGATIVE_EXPECTED_VALUE');

 return Response.json({ok,recommended,value,hail,rejected},{headers:{'Cache-Control':'no-store'}});
}
