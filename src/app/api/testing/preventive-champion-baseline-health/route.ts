import {evaluateChampionBaselineHealth} from '@/lib/preventiveChampionBaselineHealth';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const active=evaluateChampionBaselineHealth({championCalibrationError:.06,championBrierScore:.14,currentCalibrationError:.07,currentBrierScore:.15,ageDays:10,hasChampion:true});
 const retire=evaluateChampionBaselineHealth({championCalibrationError:.06,championBrierScore:.14,currentCalibrationError:.17,currentBrierScore:.28,ageDays:45,hasChampion:true});
 return Response.json({ok:active.status==='ACTIVE'&&retire.status==='RETIRE'&&retire.retire,schemaVersion:'v88-champion-baseline-health-test-1',active,retire});
}
