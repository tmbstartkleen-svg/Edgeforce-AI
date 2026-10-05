import {evaluateBaselineSuccession} from '@/lib/preventiveBaselineSuccession';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const ready=evaluateBaselineSuccession({hasActiveChampion:false,championRetired:true,windows:[
  {calibrationError:.06,brierScore:.14,sampleSize:24},
  {calibrationError:.07,brierScore:.15,sampleSize:26},
  {calibrationError:.06,brierScore:.14,sampleSize:30}
 ]});
 const idle=evaluateBaselineSuccession({hasActiveChampion:true,championRetired:false,windows:[]});
 return Response.json({ok:ready.status==='READY'&&ready.readinessScore>=.75&&idle.status==='IDLE',schemaVersion:'v89-baseline-succession-test-1',ready,idle});
}
