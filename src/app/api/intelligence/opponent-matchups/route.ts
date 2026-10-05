import {loadOpponentMatchupSummary,rebuildOpponentMatchupProfiles} from '@/lib/opponentMatchupLearning';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const summary=await loadOpponentMatchupSummary();
  return Response.json({ok:true,build:'V64',schemaVersion:'v64-opponent-matchup-1',...summary},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,build:'V64',schemaVersion:'v64-opponent-matchup-1',error:error instanceof Error?error.message:'opponent matchup summary failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await rebuildOpponentMatchupProfiles();
  return Response.json({ok:true,build:'V64',schemaVersion:'v64-opponent-matchup-1',...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'opponent matchup rebuild failed'},{status:500});
 }
}
