import {settlementLearningPolicy,summarizeSettlementLearning} from '@/lib/settlementLearning';

export const dynamic='force-dynamic';

export async function GET(){
 const provider=settlementLearningPolicy({evidenceClass:'PROVIDER_NATIVE',confidence:'PROVIDER_NATIVE'});
 const high=settlementLearningPolicy({evidenceClass:'CORROBORATED_SCORE',confidence:'HIGH'});
 const medium=settlementLearningPolicy({evidenceClass:'CORROBORATED_SCORE',confidence:'MEDIUM'});
 const single=settlementLearningPolicy({evidenceClass:'TRUSTED_PRIMARY_SINGLE',confidence:'SINGLE_SOURCE'});
 const legacy=settlementLearningPolicy(null);
 const summary=summarizeSettlementLearning([
  {features:{settlementLearning:provider}},
  {features:{settlementLearning:high}},
  {features:{settlementLearning:medium}},
  {features:{settlementLearning:single}},
  {features:{}}
 ]);
 const assertions={
  providerEligible:provider.trainingEligible===true&&provider.evidenceWeight===1,
  highEligible:high.trainingEligible===true&&high.evidenceWeight===1,
  mediumReduced:medium.trainingEligible===true&&medium.evidenceWeight===.75,
  trustedSingleExcluded:single.trainingEligible===false,
  legacyRetained:legacy.trainingEligible===true&&legacy.legacy===true,
  summaryCounts:summary.total===5&&summary.eligible===4&&summary.excluded===1&&summary.legacy===1
 };
 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V152',
  schemaVersion:'v152-settlement-learning-1',
  assertions,
  policies:{provider,high,medium,single,legacy},
  summary
 },{headers:{'Cache-Control':'no-store'}});
}
