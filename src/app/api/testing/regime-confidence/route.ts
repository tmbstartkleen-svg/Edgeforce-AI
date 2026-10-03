import {calibrateDynamicConfidence} from '@/lib/regimeConfidence';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

const base:Market={
 id:'v38-test',
 sport:'NFL',
 league:'NFL',
 event:'Away @ Home',
 selection:'Home',
 market:'moneyline',
 startTime:new Date(Date.now()+3600000).toISOString(),
 home:'Home',
 away:'Away',
 odds:-110,
 marketProb:.524,
 modelProb:.69,
 confidence:.88,
 sourceAgeMin:2,
 period:'PM'
};

export async function GET(){
 const profile={sport:'NFL',marketKey:'moneyline',sampleSize:480,calibrationError:.028,brierScore:.205,decayedScore:.74,confidenceLabel:'HIGH'};
 const stableMarket:Market={...base,consensus:{
  providerCount:4,bookCount:4,targetBook:'DraftKings',targetBookFound:true,consensusProbability:.54,consensusFairOdds:-117,
  dispersion:.012,agreement:.93,minProbability:.52,maxProbability:.56,bestOdds:-105,bestBook:'Book B',
  marketStructure:'ALIGNED',outlierBooks:[],books:['DraftKings','Book B','Book C','Book D']
 }};
 const dislocatedMarket:Market={...base,consensus:{
  providerCount:3,bookCount:3,targetBook:'DraftKings',targetBookFound:true,consensusProbability:.54,consensusFairOdds:-117,
  dispersion:.081,agreement:.44,minProbability:.43,maxProbability:.66,bestOdds:115,bestBook:'Book C',
  marketStructure:'MIXED',outlierBooks:['Book D'],books:['DraftKings','Book B','Book C']
 }};
 const stable=calibrateDynamicConfidence({market:stableMarket,rawProbability:.72,ci:[.69,.75],modelAgreement:.91,distributionConfidence:.92,profile});
 const dislocated=calibrateDynamicConfidence({market:dislocatedMarket,rawProbability:.72,ci:[.63,.81],modelAgreement:.58,distributionConfidence:.72,profile});
 const ok=stable.regime==='STABLE'
  &&dislocated.regime==='DISLOCATED'
  &&stable.dynamicConfidence>dislocated.dynamicConfidence
  &&Math.abs(dislocated.calibratedProbability-.54)<Math.abs(.72-.54);
 return Response.json({ok,stable,dislocated});
}
