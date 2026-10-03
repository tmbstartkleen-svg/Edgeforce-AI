import {runRuntimeMigrations} from '@/lib/runtimeMigrations';
import {evaluateReadiness} from '@/lib/readiness';

export const dynamic='force-dynamic';
export const runtime='nodejs';

function authorized(req:Request){
 const secret=process.env.DEPLOY_BOOTSTRAP_SECRET;
 return Boolean(secret)&&req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const migrations=await runRuntimeMigrations();
  const readiness=await evaluateReadiness({strict:false});
  return Response.json({ok:true,migrations,readiness},{
   headers:{'Cache-Control':'no-store'}
  });
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'bootstrap failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
