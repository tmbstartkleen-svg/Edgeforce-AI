import {championDriftStatus,runChampionDriftMonitor} from '@/lib/mlChampionDrift';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.ML_ACTIVATION_SECRET,process.env.CRON_SECRET,process.env.INGEST_SECRET,process.env.DEPLOY_BOOTSTRAP_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await championDriftStatus();
 return Response.json({...status,build:'V59',schemaVersion:'v59-ml-champion-drift-1'},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runChampionDriftMonitor();
  return Response.json({...result,build:'V59',schemaVersion:'v59-ml-champion-drift-1'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V59',schemaVersion:'v59-ml-champion-drift-1',error:error instanceof Error?error.message:'champion drift monitor failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
