import {buildLiveComebackWatch,type LiveComebackMarket} from '@/lib/liveComeback';

export const dynamic='force-dynamic';

export async function GET(){
 const now=new Date('2026-10-04T20:00:00.000Z');
 const strong:LiveComebackMarket={
  id:'test-live-1',
  sport:'NFL',
  league:'NFL',
  event:'Away @ Home',
  selection:'Home ML',
  market:'h2h',
  startTime:'2026-10-04T19:00:00.000Z',
  odds:+140,
  marketProb:.42,
  simProbability:.68,
  dynamicConfidence:.72,
  agreement:.78,
  grade:'STRONG',
  regime:'STABLE',
  freshness:'FRESH',
  contextQuality:{recommendationReady:true,coverage:.82,criticalCoverage:.75,score:.84},
  lineMovement:{
   openerOdds:-125,currentOdds:+140,
   openerProbability:.56,currentProbability:.42,
   probabilityMove:-.14,oddsMove:265,snapshotCount:8,
   direction:'AWAY',steam:true,steamStrength:'STRONG'
  }
 };
 const weak:LiveComebackMarket={
  ...strong,
  id:'test-live-2',
  selection:'Away ML',
  simProbability:.54,
  dynamicConfidence:.45,
  grade:'WATCH',
  contextQuality:{recommendationReady:false,coverage:.30,criticalCoverage:.20,score:.28},
  lineMovement:{...strong.lineMovement!,probabilityMove:-.01,currentProbability:.50,snapshotCount:1}
 };
 const result=buildLiveComebackWatch([strong,weak],now);
 const first=result.candidates[0];
 const ok=
  result.summary.buyLowReview===1
  &&result.summary.candidates===1
  &&first?.action==='BUY_LOW_REVIEW'
  &&first?.requiresGameStateConfirmation===true
  &&first?.missingGameState.includes('score');

 return Response.json({
  ok,
  result,
  assertions:{
   strongPromoted:first?.id==='test-live-1',
   weakRejected:!result.candidates.some(x=>x.id==='test-live-2'),
   gameStateGuardrail:first?.requiresGameStateConfirmation===true
  }
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
