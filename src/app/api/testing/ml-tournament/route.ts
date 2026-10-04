import {promotionDecision} from '@/lib/externalMlTournament';

export const dynamic='force-dynamic';

export async function GET(){
 const incumbent={compositeScore:.125};
 const strong={
  algorithm:'xgboost',serviceModelId:'xgb-1',sampleSize:1000,trainSize:700,calibrationSize:150,holdoutSize:150,
  holdoutBrier:.210,holdoutLogLoss:.610,holdoutAccuracy:.64,marketBaselineBrier:.235,marketBaselineLogLoss:.655,
  brierSkillScore:.106,calibrationError:.048,compositeScore:.145,eligible:true
 };
 const weak={...strong,serviceModelId:'xgb-2',compositeScore:.132};
 const failed={...strong,serviceModelId:'xgb-3',eligible:false,compositeScore:.30};
 const promote=promotionDecision(strong,incumbent,.01);
 const retain=promotionDecision(weak,incumbent,.01);
 const eligibility=promotionDecision(failed,null,.01);

 const assertions={
  promotesClearWinner:promote.promote===true,
  retainsIncumbentInsideMargin:retain.promote===false,
  blocksIneligible:eligibility.promote===false,
  reasoned:Boolean(promote.reason&&retain.reason&&eligibility.reason)
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({
  ok,build:'V55',assertions,promote,retain,eligibility
 },{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
