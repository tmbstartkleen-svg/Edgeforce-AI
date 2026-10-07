import {effectiveEvidenceSampleSize,meetsEffectiveEvidenceMinimum} from '@/lib/settlementLearning';

export const dynamic='force-dynamic';

export async function GET(){
 const providerPolicy={
  schemaVersion:'v152-settlement-learning-1',
  evidenceClass:'PROVIDER_NATIVE',
  confidence:'PROVIDER_NATIVE',
  trainingEligible:true,
  evidenceWeight:1,
  legacy:false,
  reason:'runtime fixture'
 };
 const mediumPolicy={
  schemaVersion:'v152-settlement-learning-1',
  evidenceClass:'CORROBORATED_SCORE',
  confidence:'MEDIUM',
  trainingEligible:true,
  evidenceWeight:.75,
  legacy:false,
  reason:'runtime fixture'
 };
 const providerRows=Array.from({length:80},()=>({features:{settlementLearning:providerPolicy}}));
 const mediumRows=Array.from({length:100},()=>({features:{settlementLearning:mediumPolicy}}));
 const mixedRows=[
  ...Array.from({length:40},()=>({features:{settlementLearning:providerPolicy}})),
  ...Array.from({length:40},()=>({features:{settlementLearning:mediumPolicy}}))
 ];
 const providerGate=meetsEffectiveEvidenceMinimum(providerRows,80);
 const mediumGate=meetsEffectiveEvidenceMinimum(mediumRows,80);
 const mixedEffective=effectiveEvidenceSampleSize(mixedRows);
 const assertions={
  providerPasses:providerGate.ok===true&&providerGate.effectiveSampleSize===80,
  mediumRawInflationBlocked:mediumGate.ok===false&&mediumGate.effectiveSampleSize===75,
  mixedWeightedCorrectly:Math.abs(mixedEffective-70)<1e-9
 };
 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V154',
  schemaVersion:'v154-effective-sample-promotion-gates-1',
  assertions,
  providerGate,
  mediumGate,
  mixedEffective
 },{headers:{'Cache-Control':'no-store'}});
}
