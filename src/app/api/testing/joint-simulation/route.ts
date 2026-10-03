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
 const key='test|moneyline|moneyline|player points|over';
 const positive:LearnedSgpMap={
  [key]:{sport:'TEST',marketA:'moneyline|moneyline',marketB:'player points|over',sampleSize:200,jointHits:120,aHits:150,bHits:150,phi:.45,lift:.12,learnedRho:.45,confidence:.90}
 };
 const negative:LearnedSgpMap={
  [key]:{sport:'TEST',marketA:'moneyline',marketB:'player points',sampleSize:200,jointHits:60,aHits:150,bHits:150,phi:-.45,lift:-.12,learnedRho:-.45,confidence:.90}
 };
 const pos=runEventJointSimulation(legs,positive,30000);
 const neg=runEventJointSimulation(legs,negative,30000);
 const independent=.49;
 const sharedLegs:JointSimulationLeg[]=[
  {
   id:'nba-ml',event:'BOS @ NYK',sport:'NBA',market:'Moneyline',selection:'NYK moneyline',
   startTime:'2026-10-03T20:00:00Z',simProbability:.62,modelProb:.62,home:'NYK',away:'BOS'
  },
  {
   id:'nba-total',event:'BOS @ NYK',sport:'NBA',market:'Game Total',selection:'BOS @ NYK over 220.5',
   startTime:'2026-10-03T20:00:00Z',simProbability:.56,modelProb:.56,home:'NYK',away:'BOS'
  },
  {
   id:'nba-prop',event:'BOS @ NYK',sport:'NBA',market:'Player Points',selection:'Jalen Brunson over 27.5',
   startTime:'2026-10-03T20:00:00Z',simProbability:.58,modelProb:.58,home:'NYK',away:'BOS',
   playerContext:{name:'Jalen Brunson',team:'NYK',projection:29,stdDev:6,availability:1,starter:true,statKey:'points'}
  }
 ];
 const shared=runEventJointSimulation(sharedLegs,undefined,20000);
 const learnedDirectionality=pos.probability>independent+.025&&neg.probability<independent-.025&&pos.probability>neg.probability;
 const sharedStateOk=shared.engine==='SHARED_EVENT_STATE'&&shared.scenarioCoverage===1&&shared.pairCorrelations.every(x=>x.source==='EVENT_STATE');
 const ok=learnedDirectionality&&sharedStateOk;
 return Response.json({ok,independent,positive:pos,negative:neg,shared,learnedDirectionality,sharedStateOk});
}
