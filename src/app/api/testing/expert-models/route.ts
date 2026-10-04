import {expertConsensus,runExpertModels} from '@/lib/expertModelSuite';
import {modelCouncil} from '@/lib/modelCouncil';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

export async function GET(){
 const market:Market={
  id:'expert-test-soccer',
  sport:'Soccer',
  league:'EPL',
  event:'Alpha vs Beta',
  selection:'Alpha',
  market:'Moneyline',
  startTime:'2026-10-05T18:00:00.000Z',
  home:'Alpha',
  away:'Beta',
  odds:-105,
  marketProb:.512,
  modelProb:.61,
  confidence:.82,
  sourceAgeMin:1,
  period:'PM',
  sportFeatures:{
   homeElo:1640,awayElo:1510,
   homeGlicko:1655,awayGlicko:1515,awayGlickoRd:70,
   homeStrength:.55,awayStrength:-.20,
   homeExpectedScore:1.85,awayExpectedScore:.88,
   homeXg:1.80,awayXg:.92,
   externalExpertProbability:.69,externalExpertConfidence:.84,
   trainedSportMlProbability:.67,trainedSportMlConfidence:.81,trainedSportMlCoverage:.88
  }
 };

 const models=runExpertModels(market);
 const ids=new Set(models.map(x=>x.id));
 const expert=expertConsensus(market);
 const council=modelCouncil(market);
 const expertVote=council.votes.find(x=>x.name==='Expert Suite');

 const assertions={
  elo:ids.has('elo-rating'),
  glicko:ids.has('glicko-rating'),
  bradleyTerry:ids.has('bradley-terry'),
  poisson:ids.has('poisson-score'),
  dixonColes:ids.has('dixon-coles'),
  expectedGoals:ids.has('expected-goals'),
  trainedSportMl:ids.has('trained-sport-ml'),
  externalMl:ids.has('external-ml-ensemble'),
  consensusRange:expert.probability>0&&expert.probability<1,
  councilIntegrated:Boolean(expertVote&&expertVote.weight>0)
 };
 const ok=Object.values(assertions).every(Boolean);

 return Response.json({
  ok,build:'V58',assertions,
  expert:{probability:expert.probability,modelCount:expert.modelCount,agreement:expert.agreement},
  modelIds:[...ids],
  expertVote:expertVote||null
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
