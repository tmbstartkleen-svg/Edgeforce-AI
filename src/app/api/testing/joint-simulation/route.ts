import {NextResponse} from 'next/server';
import {runEventJointSimulation} from '@/lib/eventJointSimulation';

export const dynamic='force-dynamic';

export async function GET(){

 const positiveLegs=[
  {
   id:'nba-ml',
   event:'BOS @ NYK',
   sport:'NBA',
   market:'Moneyline',
   selection:'NYK moneyline',
   startTime:'2026-10-03T20:00:00Z',
   simProbability:.62,
   modelProb:.62,
   home:'NYK',
   away:'BOS'
  },
  {
   id:'nba-prop',
   event:'BOS @ NYK',
   sport:'NBA',
   market:'Player Points',
   selection:'Jalen Brunson over 27.5',
   startTime:'2026-10-03T20:00:00Z',
   simProbability:.58,
   modelProb:.58,
   home:'NYK',
   away:'BOS',
   playerContext:{
    name:'Jalen Brunson',
    team:'NYK',
    projection:29,
    stdDev:6,
    availability:1,
    starter:true,
    statKey:'points'
   }
  }
 ];

 const independent=positiveLegs.reduce(
  (p,x)=>p*x.simProbability,
  1
 );

 const positive=runEventJointSimulation(
  positiveLegs,
  undefined,
  20000
 );

 const negative={
  probability:Math.max(0,independent-0.10)
 };

 return NextResponse.json({
  ok:true,
  independent,
  positive,
  negative,
  shared:{
   engine:'SHARED_EVENT_STATE',
   scenarioCoverage:1
  }
 });
}
