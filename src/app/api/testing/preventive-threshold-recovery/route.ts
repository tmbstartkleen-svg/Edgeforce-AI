import {nextThresholdRecoveryState} from '@/lib/preventiveThresholdRecovery';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const locked=nextThresholdRecoveryState({previousState:'OPEN',recoveryStreak:0,rollbackApplied:true,instabilityScore:.80,calibrationError:.20,brierScore:.30,sampleSize:30});
 const r1=nextThresholdRecoveryState({previousState:'LOCKED',recoveryStreak:0,rollbackApplied:false,instabilityScore:.20,calibrationError:.07,brierScore:.14,sampleSize:30});
 const r2=nextThresholdRecoveryState({previousState:'RECOVERING',recoveryStreak:1,rollbackApplied:false,instabilityScore:.18,calibrationError:.06,brierScore:.13,sampleSize:32});
 const open=nextThresholdRecoveryState({previousState:'RECOVERING',recoveryStreak:2,rollbackApplied:false,instabilityScore:.17,calibrationError:.05,brierScore:.12,sampleSize:35});
 return Response.json({
  ok:locked.state==='LOCKED'&&!locked.adaptiveReentryAllowed&&r1.state==='RECOVERING'&&r2.recoveryStreak===2&&open.state==='OPEN'&&open.adaptiveReentryAllowed,
  schemaVersion:'v84-threshold-recovery-test-1',
  locked,r1,r2,open
 });
}
