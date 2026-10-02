import {settleWager} from '@/lib/ledger';

function authorized(req:Request){
 const secret=process.env.INGEST_SECRET;
 return !secret||req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const body=await req.json();
  const result=await settleWager(body);
  return Response.json(result);
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'settlement failed'},{status:400});
 }
}
