import {loadLedgerHistory,recordWager} from '@/lib/ledger';
import {analyzeHistory} from '@/lib/historyAnalytics';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const secret=process.env.INGEST_SECRET;
 return !secret||req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function GET(){
 const history=await loadLedgerHistory();
 return Response.json({ok:true,history,analytics:analyzeHistory(history)},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const body=await req.json();
  const result=await recordWager(body);
  return Response.json(result,{status:201});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'invalid wager'},{status:400});
 }
}
