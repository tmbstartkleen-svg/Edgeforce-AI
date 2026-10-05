import {loadPlayerCalibrationSummary,rebuildPlayerCalibrationProfiles} from '@/lib/playerCalibration';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const summary=await loadPlayerCalibrationSummary();
  return Response.json({ok:true,build:'V63',schemaVersion:'v63-player-calibration-1',...summary},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V63',schemaVersion:'v63-player-calibration-1',error:error instanceof Error?error.message:'player calibration summary failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await rebuildPlayerCalibrationProfiles();
  return Response.json({ok:true,build:'V63',schemaVersion:'v63-player-calibration-1',...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'player calibration rebuild failed'},{status:500});
 }
}
