import {trainAndPersistSportModels,trainedModelStatus} from '@/lib/trainedSportModels';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await trainedModelStatus();
 return Response.json({...status,build:'V54',schemaVersion:'v54-trained-sport-ml-1'},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await trainAndPersistSportModels();
  return Response.json({ok:true,build:'V54',schemaVersion:'v54-trained-sport-ml-1',result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'training failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
