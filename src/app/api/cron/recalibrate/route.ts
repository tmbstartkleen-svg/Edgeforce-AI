import {runRecalibration} from '@/lib/recalibrationEngine';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runRecalibration();
  return Response.json({...result,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'recalibration failed'},{status:500});
 }
}
