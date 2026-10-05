import {evaluateThresholdStability} from '@/lib/preventiveThresholdStability';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const stable=evaluateThresholdStability({
  current:{recommendThreshold:.72,confidenceFloor:.45,riskFloor:.60,rejectEffectivenessCeiling:.38,sourceCalibrationError:.06,sourceBrierScore:.12,mode:'TUNED'},
  previous:{recommendThreshold:.73,confidenceFloor:.46,riskFloor:.61,rejectEffectivenessCeiling:.38,sourceCalibrationError:.07,sourceBrierScore:.13,mode:'TUNED'},
  recent:[]
 });
 const unstable=evaluateThresholdStability({
  current:{recommendThreshold:.82,confidenceFloor:.60,riskFloor:.72,rejectEffectivenessCeiling:.30,sourceCalibrationError:.24,sourceBrierScore:.31,mode:'CONSERVATIVE'},
  previous:{recommendThreshold:.70,confidenceFloor:.42,riskFloor:.58,rejectEffectivenessCeiling:.42,sourceCalibrationError:.05,sourceBrierScore:.11,mode:'TUNED'},
  recent:[
   {recommendThreshold:.70,confidenceFloor:.42,riskFloor:.58,rejectEffectivenessCeiling:.42,sourceCalibrationError:.05,sourceBrierScore:.11,mode:'TUNED'},
   {recommendThreshold:.79,confidenceFloor:.55,riskFloor:.67,rejectEffectivenessCeiling:.34,sourceCalibrationError:.21,sourceBrierScore:.28,mode:'CONSERVATIVE'},
   {recommendThreshold:.72,confidenceFloor:.45,riskFloor:.60,rejectEffectivenessCeiling:.38,sourceCalibrationError:.09,sourceBrierScore:.17,mode:'BASELINE'},
   {recommendThreshold:.82,confidenceFloor:.60,riskFloor:.72,rejectEffectivenessCeiling:.30,sourceCalibrationError:.24,sourceBrierScore:.31,mode:'CONSERVATIVE'}
  ]
 });
 return Response.json({
  ok:stable.status==='STABLE'&&unstable.status==='ROLLBACK'&&unstable.rollbackRequired,
  schemaVersion:'v83-threshold-stability-test-1',
  stable,unstable
 });
}
