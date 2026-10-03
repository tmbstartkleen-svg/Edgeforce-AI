import type {Market} from '@/lib/types';
import {runSportOutcomeSimulation} from '@/lib/sportOutcomeSimulation';
import {runGameStateSimulation} from '@/lib/simulation';

function market(sport:string,id:string,home:string,away:string,features:Record<string,number>={}):Market{
 return {
  id,sport,league:'TEST',event:`${away} @ ${home}`,selection:`${home} ML`,market:'Moneyline',
  startTime:'2026-10-04T20:00:00Z',home,away,odds:-120,marketProb:.545,modelProb:.62,
  confidence:.75,sourceAgeMin:0,period:'PM',sportFeatures:features
 };
}

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const cases=[
  market('MLB','mlb','Home MLB','Away MLB',{starter:.1,bullpen:.05,lineup:.08}),
  market('NFL','nfl','Home NFL','Away NFL',{quarterback:.1,trenches:.05,weather:0}),
  market('NBA','nba','Home NBA','Away NBA',{pace:.08,shooting:.06}),
  market('NHL','nhl','Home NHL','Away NHL',{goalie:.08,shotQuality:.06}),
  market('Soccer','soccer','Home Club','Away Club',{xg:.1,keeper:.05}),
  market('Tennis','tennis','Player A','Player B',{serve:.08,return:.06,surface:.04}),
  market('Table Tennis','tt','Player C','Player D',{serve:.08,return:.08})
 ];
 const results=cases.map(m=>{
  const sim=runSportOutcomeSimulation(m,1000,runGameStateSimulation);
  return {
   sport:m.sport,engine:sim.engine,runs:sim.runs,probability:sim.probability,
   microUnit:sim.projection.microUnit,microUnitCount:sim.projection.microUnitCount
  };
 });
 const expected=[
  'MLB_PLATE_APPEARANCE_MONTE_CARLO',
  'FOOTBALL_DRIVE_MONTE_CARLO',
  'BASKETBALL_POSSESSION_MONTE_CARLO',
  'NHL_SHIFT_MONTE_CARLO',
  'SOCCER_CHANCE_MONTE_CARLO',
  'TENNIS_POINT_GAME_SET_MONTE_CARLO',
  'TABLE_TENNIS_POINT_GAME_MONTE_CARLO'
 ];
 const propMarket:Market={
  ...market('NFL','prop','Home NFL','Away NFL',{projection:275,propStd:45,quarterback:.1}),
  market:'Player Prop',selection:'Sample QB over 249.5 passing yards',
  playerContext:{name:'Sample QB',team:'Home NFL',projection:275,stdDev:45,statKey:'passing yards'}
 };
 const propSim=runSportOutcomeSimulation(propMarket,1000,runGameStateSimulation);

 const partialMarket:Market={
  ...market('NFL','partial','Home NFL','Away NFL',{quarterback:.1}),
  market:'1st Quarter Moneyline',selection:'Home NFL 1st Quarter ML'
 };
 const partialSim=runSportOutcomeSimulation(partialMarket,1000,runGameStateSimulation);

 const ok=
  results.every((x,i)=>x.engine===expected[i]&&x.runs===1000&&x.microUnit&&Number(x.microUnitCount)>0&&x.probability>0&&x.probability<1)&&
  propSim.engine==='PLAYER_DISTRIBUTION_MONTE_CARLO'&&
  partialSim.engine==='PROBABILITY_STATE_FALLBACK';
 return Response.json({
  ok,
  results,
  propRouting:{engine:propSim.engine,probability:propSim.probability},
  partialRouting:{engine:partialSim.engine,probability:partialSim.probability}
 });
}
