import {closePredictionPosition,loadOpenPredictionPositions,recordPredictionPosition} from '@/lib/predictionPositions';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const secret=process.env.INGEST_SECRET;
 return !secret||req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function GET(){
 const positions=await loadOpenPredictionPositions();
 return Response.json({ok:true,positions},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const body=await req.json();
  const result=await recordPredictionPosition(body);
  return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'invalid prediction position'},{status:400});
 }
}

export async function PATCH(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const body=await req.json();
  const id=Number(body?.id);
  if(!Number.isFinite(id)||id<=0)throw new Error('valid position id is required');
  const result=await closePredictionPosition(id,body?.realizedPnl===undefined?undefined:Number(body.realizedPnl));
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'invalid close request'},{status:400});
 }
}