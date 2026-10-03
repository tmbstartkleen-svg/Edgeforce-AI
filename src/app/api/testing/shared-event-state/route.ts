import {runEventJointSimulation,type JointSimulationLeg} from '@/lib/eventJointSimulation';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const sameEvent:JointSimulationLeg[]=[
  {
   id:'nba-home-ml',event:'Boston @ New York',sport:'NBA',
   market:'Moneyline',selection:'New York moneyline',
   startTime:'2026-10-03T23:00:00Z',simProbability:.62,
   home:'New York',away:'Boston',modelProb:.62
  },
  {
   id:'nba-total-over',event:'Boston @ New York',sport:'NBA',
   market:'Total',selection:'Over 221.5',
   startTime:'2026-10-03T23:00:00Z',simProbability:.56,
   home:'New York',away:'Boston',modelProb:.56
  },
  {
   id:'nba-player-over',event:'Boston @ New York',sport:'NBA',
   market:'Player Points',selection:'Jalen Star over 24.5',
   startTime:'2026-10-03T23:00:00Z',simProbability:.58,
   home:'New York',away:'Boston',modelProb:.58,
   playerContext:{name:'Jalen Star',team:'New York',projection:27.5,stdDev:5.5,availability:1,starter:true,statKey:'points'}
  }
 ];

 const unsupported:JointSimulationLeg[]=[
  {
   id:'mma-a',event:'Fighter A vs Fighter B',sport:'MMA',
   market:'Moneyline',selection:'Fighter A moneyline',
   startTime:'2026-10-03T23:00:00Z',simProbability:.60
  },
  {
   id:'mma-b',event:'Fighter A vs Fighter B',sport:'MMA',
   market:'Total rounds',selection:'Over 2.5',
   startTime:'2026-10-03T23:00:00Z',simProbability:.55
  }
 ];

 const same=runEventJointSimulation(sameEvent,undefined,12000);
 const fallback=runEventJointSimulation(unsupported,undefined,12000);
 const ok=
  same.engine==='SHARED_EVENT_STATE' &&
  same.scenarioCoverage===1 &&
  same.eventCount===1 &&
  same.pairCorrelations.every(x=>x.source==='EVENT_STATE') &&
  fallback.engine==='GAUSSIAN_COPULA_FALLBACK';

 return Response.json({ok,sameEvent:same,fallback});
}
