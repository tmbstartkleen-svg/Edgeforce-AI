import {evaluateGovernanceWatchdog} from '@/lib/preventiveBaselineGovernanceWatchdog';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const healthy=evaluateGovernanceWatchdog({staleCycles:0,expiredLock:false,leaseLossCount:0});
 const recover=evaluateGovernanceWatchdog({staleCycles:2,expiredLock:true,leaseLossCount:1});
 return Response.json({ok:healthy.status==='HEALTHY'&&recover.status==='RECOVERY_REQUIRED',schemaVersion:'v95-baseline-governance-watchdog-test-1',healthy,recover});
}
