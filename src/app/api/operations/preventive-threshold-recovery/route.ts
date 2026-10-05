import {loadThresholdRecoverySummary,runThresholdRecoveryGovernor} from '@/lib/preventiveThresholdRecovery';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 try{
  const report=await loadThresholdRecoverySummary();
  return Response.json({ok:true,build:'V84',schemaVersion:'v84-threshold-recovery-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'threshold recovery load failed'},{status:500});
 }
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const report=await runThresholdRecoveryGovernor();
  return Response.json({ok:true,build:'V84',schemaVersion:'v84-threshold-recovery-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'threshold recovery update failed'},{status:500});
 }
}
