import {buildCashoutPolicyGovernance,persistCashoutPolicyGovernance} from '@/lib/cashoutPolicyGovernance';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildCashoutPolicyGovernance();
 const persistence=await persistCashoutPolicyGovernance(report.rows);
 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  generatedAt:new Date().toISOString(),
  persisted:persistence.persisted,
  ...report,
  notes:[
   'Champion promotion requires enough settled samples, lower regret than the 1% baseline, non-negative accuracy lift, and stable recent performance.',
   'Drifting or regressing policies are blocked from promotion.',
   'Governance is advisory only and cannot execute sportsbook actions.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
