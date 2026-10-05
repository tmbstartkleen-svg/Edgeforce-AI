import {cashoutLearningSummary,recordCashoutObservation,type CashoutObservationInput} from '@/lib/cashoutLearning';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await cashoutLearningSummary();
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  ...report,
  notes:[
   'Cash-out learning only grades alerts when a real offer, user action, and eventual outcome are recorded.',
   'Pending observations remain ungraded.',
   'The resulting multiplier is sample-shrunk and bounded before it can affect command priority.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}

export async function POST(req:Request){
 if(process.env.INGEST_SECRET&&req.headers.get('authorization')!==`Bearer ${process.env.INGEST_SECRET}`){
  return Response.json({ok:false,error:'unauthorized'},{status:401});
 }
 const body=await req.json() as Partial<CashoutObservationInput>;
 const stake=Number(body.stake);
 const originalOdds=Number(body.originalOdds);
 const currentWinProbability=Number(body.currentWinProbability);
 const cashoutOffer=Number(body.cashoutOffer);
 const action=String(body.action||'NO_ACTION') as CashoutObservationInput['action'];
 if(!Number.isFinite(stake)||stake<=0||!Number.isFinite(originalOdds)||!Number.isFinite(currentWinProbability)||!Number.isFinite(cashoutOffer)||cashoutOffer<0){
  return Response.json({ok:false,error:'stake, originalOdds, currentWinProbability and cashoutOffer are required'},{status:400});
 }
 if(!['CASH_OUT','HOLD','NO_ACTION'].includes(action)){
  return Response.json({ok:false,error:'invalid action'},{status:400});
 }
 const outcome=body.outcome&&['WON','LOST','VOID','PENDING'].includes(String(body.outcome))
  ?body.outcome
  :'PENDING';
 const result=await recordCashoutObservation({
  commandId:body.commandId,
  ladderId:body.ladderId,
  checkpointLabel:body.checkpointLabel,
  stake,
  originalOdds,
  currentWinProbability,
  cashoutOffer,
  action,
  outcome,
  finalPayout:Number.isFinite(Number(body.finalPayout))?Number(body.finalPayout):undefined,
  sportsbook:body.sportsbook,
  metadata:body.metadata
 });
 return Response.json({ok:true,...result});
}
