import {cashoutReconciliationPreview,reconcileCashoutObservations,cashoutSettlementSummary} from '@/lib/cashoutReconciliation';

export const dynamic='force-dynamic';

export async function GET(){
 const [preview,summary]=await Promise.all([cashoutReconciliationPreview(),cashoutSettlementSummary()]);
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  preview,
  summary,
  notes:[
   'Only RESOLVED or VOID universal truth records can settle a pending cash-out observation.',
   'DISPUTED and OPEN events remain untouched.',
   'Settlement grades the hold counterfactual; no sportsbook action is executed.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}

export async function POST(req:Request){
 if(process.env.INGEST_SECRET&&req.headers.get('authorization')!==`Bearer ${process.env.INGEST_SECRET}`){
  return Response.json({ok:false,error:'unauthorized'},{status:401});
 }
 const result=await reconcileCashoutObservations();
 return Response.json({ok:true,...result});
}
