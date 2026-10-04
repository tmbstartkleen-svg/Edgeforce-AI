import {mlDeploymentAttestationStatus,recordMlDeploymentAttestation} from '@/lib/mlDeploymentAttestation';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[
  process.env.ML_ACTIVATION_SECRET,
  process.env.INGEST_SECRET,
  process.env.CRON_SECRET,
  process.env.DEPLOY_BOOTSTRAP_SECRET
 ].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await mlDeploymentAttestationStatus();
 return Response.json({...status,build:'V61',schemaVersion:'v61-ml-deployment-attestation-1'},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({})) as {deploymentId?:string|null};
 try{
  const result=await recordMlDeploymentAttestation({deploymentId:body.deploymentId||null});
  return Response.json(result,{status:result.ok?200:202,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'ML deployment attestation failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
