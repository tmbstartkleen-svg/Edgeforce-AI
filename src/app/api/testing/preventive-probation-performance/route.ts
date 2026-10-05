import {evaluateProbationPerformance} from '@/lib/preventiveProbationPerformance';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const stable=evaluateProbationPerformance({baselineCalibrationError:.06,baselineBrierScore:.14,currentCalibrationError:.07,currentBrierScore:.15,probationStage:2,probationState:'STAGE_2'});
 const rollback=evaluateProbationPerformance({baselineCalibrationError:.06,baselineBrierScore:.14,currentCalibrationError:.15,currentBrierScore:.27,probationStage:3,probationState:'STAGE_3'});
 return Response.json({ok:stable.status==='STABLE'&&rollback.status==='ROLLBACK'&&rollback.rollbackStage===2,schemaVersion:'v86-probation-performance-test-1',stable,rollback});
}
