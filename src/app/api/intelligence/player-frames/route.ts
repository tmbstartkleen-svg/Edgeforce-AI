import {loadPlayerFeatureFrameSummary} from '@/lib/playerFeatureFrames';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const summary=await loadPlayerFeatureFrameSummary();
  return Response.json({ok:true,build:'V62',schemaVersion:'v62-player-feature-frames-1',...summary},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V62',schemaVersion:'v62-player-feature-frames-1',error:error instanceof Error?error.message:'player frame summary failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
