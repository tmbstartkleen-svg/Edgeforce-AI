import {evaluateSuccessorValidation} from '@/lib/preventiveSuccessorValidation';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const healthy=evaluateSuccessorValidation({championSource:'SUCCESSION_CHAMPION',previousStatus:'VALIDATING',previousStreak:2,baselineCalibrationError:.06,baselineBrierScore:.14,currentCalibrationError:.07,currentBrierScore:.15,sampleSize:30});
 const revert=evaluateSuccessorValidation({championSource:'SUCCESSION_CHAMPION',previousStatus:'VALIDATING',previousStreak:1,baselineCalibrationError:.06,baselineBrierScore:.14,currentCalibrationError:.14,currentBrierScore:.25,sampleSize:30});
 return Response.json({ok:healthy.status==='CONFIRMED'&&!healthy.revert&&revert.status==='REVERT'&&revert.revert,schemaVersion:'v91-successor-validation-test-1',healthy,revert});
}
