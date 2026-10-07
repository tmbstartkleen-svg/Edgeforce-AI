import {evaluateFinalScoreSettlementEvidence} from '@/lib/scoreSettlementFallback';

export const dynamic='force-dynamic';

export async function GET(){
 const base={status:'FINAL',home:{name:'Certified Home',score:31},away:{name:'Certified Away',score:24}};
 const corroborated=evaluateFinalScoreSettlementEvidence({
  ...base,source:'espn-cdn',
  consensus:{confidence:'HIGH',sourceCount:3,agreeingSources:2,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });
 const trustedSingle=evaluateFinalScoreSettlementEvidence({
  ...base,source:'nhl-web',
  consensus:{confidence:'SINGLE_SOURCE',sourceCount:1,agreeingSources:1,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });
 const conflict=evaluateFinalScoreSettlementEvidence({
  ...base,source:'espn-cdn',
  consensus:{confidence:'MEDIUM',sourceCount:3,agreeingSources:1,activeConflict:true,statusConflict:false,scoreConflict:true,laggingSources:[]}
 });
 const untrustedSingle=evaluateFinalScoreSettlementEvidence({
  ...base,source:'thesportsdb',
  consensus:{confidence:'SINGLE_SOURCE',sourceCount:1,agreeingSources:1,activeConflict:false,statusConflict:false,scoreConflict:false,laggingSources:[]}
 });

 const assertions={
  corroboratedAccepted:corroborated.accepted===true&&corroborated.confidence==='HIGH',
  trustedPrimarySingleAccepted:trustedSingle.accepted===true&&trustedSingle.trustedSingleSource===true,
  activeConflictBlocked:conflict.accepted===false&&conflict.activeConflict===true,
  untrustedSingleBlocked:untrustedSingle.accepted===false&&untrustedSingle.trustedSingleSource===false
 };

 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V150',
  schemaVersion:'v150-certified-score-settlement-1',
  assertions,
  cases:{corroborated,trustedSingle,conflict,untrustedSingle}
 },{headers:{'Cache-Control':'no-store'}});
}
