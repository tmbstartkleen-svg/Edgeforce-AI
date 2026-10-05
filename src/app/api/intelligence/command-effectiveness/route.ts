import {buildCommandEffectiveness} from '@/lib/commandLearning';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildCommandEffectiveness();
 return Response.json({
  ok:true,
  configured:report.configured,
  generatedAt:new Date().toISOString(),
  rows:report.rows,
  ungradedCashout:report.ungradedCashout,
  notes:[
   'Command effectiveness measures post-alert behavior, not wagering profit.',
   'PRIME/READY alerts are graded against later Master Edge score/edge behavior; weakening/exit alerts are graded against later lifecycle states.',
   'Cash-out alerts remain UNSCORED until a real cash-out action/offer/result is recorded.',
   'Multipliers are sample-shrunk and tightly bounded before affecting queue ordering.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
