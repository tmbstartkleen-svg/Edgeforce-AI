import {externalMlTournamentStatus,runExternalMlTournament} from '@/lib/externalMlTournament';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await externalMlTournamentStatus();
 return Response.json({...status,build:'V55',schemaVersion:'v55-external-ml-tournament-1'},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runExternalMlTournament();
  return Response.json({ok:true,build:'V55',schemaVersion:'v55-external-ml-tournament-1',result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'external ML tournament failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
