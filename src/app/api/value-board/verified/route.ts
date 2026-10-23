import {buildVerifiedValueBoard} from '@/lib/verified-value-board';
import {evaluateOddsStage1Acceptance} from '@/lib/odds-stage1-acceptance';

export const dynamic='force-dynamic';
/**
 * Fail-closed endpoint for independently corroborated, calibrated bets.
 * Evidence must come from independently audited server-side collectors,
 * never caller-submitted booleans, and is not yet wired to an authorized
 * persistence / model-certification service.
 *
 * The separate /api/value-board endpoint retains RESEARCH-ONLY,
 * market-derived provisional quotes and never feeds this verified lane.
 */
export async function GET(){
 const asOf=Date.now();
 const stage1=evaluateOddsStage1Acceptance({},asOf);
 const board=buildVerifiedValueBoard([],asOf,50);
 return Response.json({
  ok:true,
  mode:'VERIFIED_ONLY',
  readiness:'BLOCKED_AWAITING_AUDITED_SOURCE_AND_MODEL_EVIDENCE',
  asOf:new Date(asOf).toISOString(),
  board,
  certified:false,
  eligibleForAutomatedBetAlerts:false,
  requiredProof:{
   stage1:stage1.blockers,
   model:'HELD_OUT_MODEL_CALIBRATION_AND_INDEPENDENT_PROBABILITY_EVIDENCE_NOT_AVAILABLE',
   crossBook:'SECOND_INDEPENDENT_QUOTES_WITH_MATCHED_OUTCOME_AND_LINE_NOT_AVAILABLE'
  },
  warning:'No verified +EV bets are available from authenticated server-side evidence. Provisional market-reference estimates are research only; they are not independently simulated odds.'
 },{headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
