import {evaluateBaselineLifecycleConsistency} from '@/lib/preventiveBaselineConsistency';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const healthy=evaluateBaselineLifecycleConsistency({championSource:'CONFIRMED_SUCCESSION_CHAMPION',championActive:true,healthStatus:'ACTIVE',healthRetired:false,successionStatus:'IDLE',handoffStatus:'CONFIRMED',handoffPromoted:true,validationStatus:'GRADUATED',validationReverted:false,graduationStatus:'GRADUATED',graduationGraduated:true});
 const broken=evaluateBaselineLifecycleConsistency({championSource:'CONFIRMED_SUCCESSION_CHAMPION',championActive:true,healthStatus:'ACTIVE',healthRetired:true,successionStatus:'READY',handoffStatus:'PROMOTED',handoffPromoted:true,validationStatus:'CONFIRMED',validationReverted:false,graduationStatus:'WAITING',graduationGraduated:false});
 return Response.json({ok:healthy.status==='HEALTHY'&&broken.status==='REPAIR_REQUIRED'&&broken.repairCodes.length>=4,schemaVersion:'v93-baseline-consistency-test-1',healthy,broken});
}
