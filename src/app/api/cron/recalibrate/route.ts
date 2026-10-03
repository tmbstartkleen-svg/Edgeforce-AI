import {runRecalibration} from '@/lib/recalibrationEngine';
import {rebuildLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const [modelCalibration,sgpCorrelation]=await Promise.all([
   runRecalibration(),
   rebuildLearnedSgpCorrelations()
  ]);
  return Response.json({ok:true,modelCalibration,sgpCorrelation,ranAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'recalibration failed'},{status:500});
 }
}
