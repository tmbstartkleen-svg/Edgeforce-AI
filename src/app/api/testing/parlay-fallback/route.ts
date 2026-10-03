import {selectParlayPool} from '@/lib/parlays';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const base={
  simulationRuns:10000,rawSimProbability:.62,simCi:[.60,.64] as [number,number],
  uncertainty:.1,confidenceLabel:'MEDIUM',regime:'STABLE',historicalShrinkage:0,
  consensusBlend:0,dynamicConfidenceComponents:{},daysOut:.5,bucket:'TODAY',
  simEngine:'TEST',simProjection:{},fairOdds:-150,edge:.05,kelly:.04,
  recommendedStake:.01,agreement:.7,sportModelProbability:.62,sportAdjustment:0,
  sportFactors:[],marketProb:.57,modelProb:.62,confidence:.7,sourceAgeMin:1,
  period:'PM',sport:'NFL',league:'NFL',market:'Moneyline',startTime:new Date(Date.now()+3600000).toISOString(),
  home:'Home',away:'Away',event:'Away @ Home',odds:-120
 };

 const strictRows=[
  {...base,id:'elite',selection:'Home',grade:'ELITE',expectedValue:.08,simProbability:.66,dynamicConfidence:.72,freshness:'FRESH'},
  {...base,id:'strong',selection:'Away',grade:'STRONG',expectedValue:.05,simProbability:.61,dynamicConfidence:.68,freshness:'FRESH'}
 ] as any[];

 const fallbackRows=[
  {...base,id:'watch-a',selection:'Home',grade:'WATCH',expectedValue:.03,simProbability:.60,dynamicConfidence:.62,freshness:'FRESH'},
  {...base,id:'watch-b',selection:'Away',grade:'WATCH',expectedValue:.02,simProbability:.58,dynamicConfidence:.57,freshness:'AGING'},
  {...base,id:'pass',selection:'Draw',grade:'PASS',expectedValue:-.01,simProbability:.49,dynamicConfidence:.50,freshness:'FRESH'}
 ] as any[];

 const strict=selectParlayPool(strictRows as any,2);
 const fallback=selectParlayPool(fallbackRows as any,2);
 const ok=
  strict.qualification==='STRICT' &&
  strict.fallbackUsed===false &&
  strict.pool.length===2 &&
  fallback.qualification==='WATCH_FALLBACK' &&
  fallback.fallbackUsed===true &&
  fallback.pool.length===2;

 return Response.json({ok,strict,fallback},{headers:{'Cache-Control':'no-store'}});
}
