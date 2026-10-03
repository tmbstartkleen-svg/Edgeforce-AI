import {getValidationLabStatus,runValidationLab} from '@/lib/validationLab';

export const dynamic='force-dynamic';

export async function GET(){
 const status=await getValidationLabStatus();
 return Response.json({build:'V51',...status},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runValidationLab();
  return Response.json({build:'V51',...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V51',error:error instanceof Error?error.message:'validation run failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
