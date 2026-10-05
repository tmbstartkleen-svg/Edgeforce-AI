import {evaluateSuccessorPromotion} from '@/lib/preventiveBaselineHandoff';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const promote=evaluateSuccessorPromotion({hasActiveChampion:false,successionStatus:'READY',readinessScore:.88,candidateCalibrationError:.06,candidateBrierScore:.14,candidateSampleSize:30,sourceWindows:5});
 const blocked=evaluateSuccessorPromotion({hasActiveChampion:true,successionStatus:'READY',readinessScore:.90,candidateCalibrationError:.05,candidateBrierScore:.13,candidateSampleSize:35,sourceWindows:5});
 return Response.json({ok:promote.eligible&&promote.status==='PROMOTE'&&!blocked.eligible&&blocked.status==='IDLE',schemaVersion:'v90-baseline-handoff-test-1',promote,blocked});
}
