import {activateMlService,mlActivationStatus} from '@/lib/mlActivation';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET,process.env.DEPLOY_BOOTSTRAP_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await mlActivationStatus();
 return Response.json(status,{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let runTournament=true;
 try{
  const body=await req.json().catch(()=>({})) as {runTournament?:boolean};
  runTournament=body.runTournament!==false;
 }catch{}
 try{
  const result=await activateMlService({runTournament});
  const status=result.readiness.active?200:(result.health.configured?202:503);
  return Response.json(result,{status,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'ML activation failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
