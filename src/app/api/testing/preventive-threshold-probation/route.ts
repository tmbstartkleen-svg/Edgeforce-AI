import {nextThresholdProbationState} from '@/lib/preventiveThresholdProbation';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const healthy={reentryAllowed:true,recoveryState:'OPEN',rollbackReferenceId:10,instabilityScore:.20,calibrationError:.06,brierScore:.14,sampleSize:30};
 const s1=nextThresholdProbationState({previousState:'INACTIVE',stageStreak:0,...healthy});
 const s2=nextThresholdProbationState({previousState:'STAGE_1',stageStreak:1,...healthy});
 const bad=nextThresholdProbationState({previousState:'STAGE_2',stageStreak:1,...healthy,calibrationError:.18});
 return Response.json({ok:s1.adaptiveWeight===.25&&s2.state==='STAGE_2'&&s2.adaptiveWeight===.5&&bad.state==='REVERTED'&&bad.adaptiveWeight===0,schemaVersion:'v85-threshold-probation-test-1',s1,s2,bad});
}
