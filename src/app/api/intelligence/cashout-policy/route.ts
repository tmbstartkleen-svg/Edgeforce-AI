import {buildCashoutPolicies,persistCashoutPolicies} from '@/lib/cashoutPolicy';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildCashoutPolicies();
 const persistence=await persistCashoutPolicies(report.rows);
 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  generatedAt:new Date().toISOString(),
  persisted:persistence.persisted,
  ...report,
  notes:[
   'Cash-out policy thresholds are learned from settled counterfactual outcomes and shrink toward the original 1% baseline when samples are small.',
   'Policies are advisory only and never accept sportsbook cash-out offers automatically.',
   'Sportsbook-specific policy is preferred; if unavailable, the engine falls back to broader alert-type history or the baseline threshold.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
