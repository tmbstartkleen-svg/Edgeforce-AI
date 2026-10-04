import {firstChampionTournamentStatus,runFirstChampionTournament} from '@/lib/mlFirstTournament';

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
 const status=await firstChampionTournamentStatus();
 return Response.json(status,{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runFirstChampionTournament();
  const status=result.evidence.launchReady?200:202;
  return Response.json(result,{status,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({
   ok:false,build:'V58',schemaVersion:'v58-first-champion-tournament-1',
   error:error instanceof Error?error.message:'first champion tournament failed'
  },{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
