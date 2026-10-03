import {runEventJointSimulation,type JointSimulationLeg} from '@/lib/eventJointSimulation';
import type {LearnedSgpMap} from '@/lib/learnedSgpCorrelation';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const legs:JointSimulationLeg[]=[
  {
   id:'a',event:'A @ B',sport:'TEST',market:'Player Points',selection:'Player A over 20.5',
   startTime:'2026-10-03T20:00:00Z',simProbability:.70,playerContext:{name:'Player A',team:'A'}
  },
  {
   id:'b',event:'A @ B',sport:'TEST',market:'Moneyline',selection:'A moneyline',
   startTime:'2026-10-03T20:00:00Z',simProbability:.70
  }
 ];
 const key='test|moneyline|player points';
 const positive:LearnedSgpMap={
  [key]:{sport:'TEST',marketA:'moneyline',marketB:'player points',sampleSize:200,jointHits:120,aHits:150,bHits:150,phi:.45,lift:.12,learnedRho:.45,confidence:.90}
 };
 const negative:LearnedSgpMap={
  [key]:{sport:'TEST',marketA:'moneyline',marketB:'player points',sampleSize:200,jointHits:60,aHits:150,bHits:150,phi:-.45,lift:-.12,learnedRho:-.45,confidence:.90}
 };
 const pos=runEventJointSimulation(legs,positive,30000);
 const neg=runEventJointSimulation(legs,negative,30000);
 const independent=.49;
 const ok=pos.probability>independent+.025&&neg.probability<independent-.025&&pos.probability>neg.probability;
 return Response.json({ok,independent,positive:pos,negative:neg});
}
