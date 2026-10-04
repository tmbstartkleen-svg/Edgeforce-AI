import {predictWithArtifact,trainSportArtifact,type TrainingHistoryRow} from '@/lib/trainedSportModels';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

export async function GET(){
 const rows:TrainingHistoryRow[]=[];
 for(let i=0;i<260;i++){
  const signal=((i*37)%101)/50-1;
  const marketProb=.50+(i%5-2)*.004;
  const outcome=(signal+.20*Math.sin(i*.37)>0?1:0) as 0|1;
  const modelProbability=Math.max(.08,Math.min(.92,.50+signal*.22));
  rows.push({
   occurredAt:new Date(Date.UTC(2025,0,1+i)).toISOString(),
   sport:'NFL',marketKey:'Moneyline',predicted:modelProbability,
   odds:marketProb>=.5?Math.round(-100*marketProb/(1-marketProb)):Math.round(100*(1-marketProb)/marketProb),
   outcome,
   features:{
    modelProbability,
    simProbability:Math.max(.05,Math.min(.95,.50+signal*.25)),
    dynamicConfidence:.72,
    consensus:{agreement:.78,dispersion:.025,sharpPublicGap:signal*.015},
    contextQuality:{score:.82,coverage:.84,criticalCoverage:.90},
    sportFeatures:{quarterback:signal,efficiency:signal*.85,trenches:signal*.55,home:signal*.20,form:signal*.70,rest:.1}
   }
  });
 }
 const artifact=trainSportArtifact(rows,'NFL','*',{minSample:80,minHoldout:20});
 const market=(signal:number):Market=>({
  id:`test-${signal}`,sport:'NFL',league:'NFL',event:'A @ B',selection:'B',market:'Moneyline',
  startTime:'2026-10-05T20:00:00.000Z',home:'B',away:'A',odds:-110,marketProb:.524,
  modelProb:.50+signal*.22,confidence:.80,sourceAgeMin:1,period:'PM',
  sportFeatures:{quarterback:signal,efficiency:signal*.85,trenches:signal*.55,home:signal*.20,form:signal*.70,rest:.1}
 });
 const positive=predictWithArtifact(market(.85),artifact);
 const negative=predictWithArtifact(market(-.85),artifact);
 const assertions={
  enoughHistory:artifact.sampleSize===260,
  chronologicalHoldout:artifact.holdoutSize>=20,
  marketBaselineCompared:artifact.marketBaselineBrier>0,
  positiveSkill:artifact.brierSkillScore>.01,
  promoted:artifact.promoted===true,
  directional:positive.probability>negative.probability,
  probabilityRange:positive.probability>0&&positive.probability<1&&negative.probability>0&&negative.probability<1
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({
  ok,build:'V54',assertions,
  artifact:{
   sport:artifact.sport,marketKey:artifact.marketKey,algorithm:artifact.algorithm,
   sampleSize:artifact.sampleSize,trainSize:artifact.trainSize,calibrationSize:artifact.calibrationSize,
   holdoutSize:artifact.holdoutSize,brierSkillScore:artifact.brierSkillScore,
   holdoutBrier:artifact.holdoutBrier,marketBaselineBrier:artifact.marketBaselineBrier,
   calibrationError:artifact.calibrationError,promoted:artifact.promoted,promotionReason:artifact.promotionReason,
   topFeatures:Object.entries(artifact.featureImportance).slice(0,8)
  },
  positive,negative
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
