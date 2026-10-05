import {evaluateGovernanceLease} from '@/lib/preventiveBaselineGovernanceCycle';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const completed=evaluateGovernanceLease({alreadyCompleted:true,lockAvailable:true});
 const locked=evaluateGovernanceLease({alreadyCompleted:false,lockAvailable:false});
 const acquired=evaluateGovernanceLease({alreadyCompleted:false,lockAvailable:true});
 return Response.json({ok:completed.status==='SKIPPED_IDEMPOTENT'&&locked.status==='SKIPPED_LOCKED'&&acquired.status==='ACQUIRED'&&acquired.run,schemaVersion:'v94-baseline-governance-cycle-test-1',completed,locked,acquired});
}
