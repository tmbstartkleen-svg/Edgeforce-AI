import {runShadowRecovery,shadowRecoveryStatus} from '@/lib/mlShadowRecovery';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.ML_ACTIVATION_SECRET,process.env.CRON_SECRET,process.env.INGEST_SECRET,process.env.DEPLOY_BOOTSTRAP_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await shadowRecoveryStatus();
 return Response.json({...status,build:'V61',schemaVersion:'v61-shadow-league-1'},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runShadowRecovery();
  return Response.json({...result,build:'V61',schemaVersion:'v61-shadow-league-1'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V61',schemaVersion:'v61-shadow-league-1',error:error instanceof Error?error.message:'shadow recovery failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
