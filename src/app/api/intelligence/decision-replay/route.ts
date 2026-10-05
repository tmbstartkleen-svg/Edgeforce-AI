import {buildDecisionReplay,persistDecisionReplay} from '@/lib/decisionReplay';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildDecisionReplay();
 const persistence=await persistDecisionReplay(report.summary,report.ordering);
 return Response.json({
  ok:true,
  analyticsOnly:true,
  generatedAt:new Date().toISOString(),
  persisted:persistence.persisted,
  ...report,
  notes:[
   'Replay uses persisted decision, Master Edge, price-capture, and lifecycle snapshots from the prior 30 days.',
   'PRIME/READY are rewarded for sustained score/edge/value; HOLD/REMOVE are rewarded when later decay validates caution.',
   'The ordering test does not promote models or execute wagers; it validates whether the decision stack is behaving as intended.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
