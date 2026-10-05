import {evaluateSupervisionCycleGate} from '@/lib/preventiveSupervisionCycle';
export const dynamic='force-dynamic';
export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const reusedContextCount=8;
 const stepCount=11;
 const duplicate=evaluateSupervisionCycleGate({alreadyCompleted:true,lockAvailable:true});
 const locked=evaluateSupervisionCycleGate({alreadyCompleted:false,lockAvailable:false});
 const run=evaluateSupervisionCycleGate({alreadyCompleted:false,lockAvailable:true});
 return Response.json({
  ok:reusedContextCount===8&&stepCount===11&&duplicate.status==='SKIPPED_IDEMPOTENT'&&locked.status==='SKIPPED_LOCKED'&&run.status==='RUN',
  schemaVersion:'v96-supervision-cycle-test-1',reusedContextCount,stepCount,duplicate,locked,run
 });
}
