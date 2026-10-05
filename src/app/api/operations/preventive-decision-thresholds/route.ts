import {loadPreventiveDecisionThresholds,runPreventiveDecisionThresholdGovernor} from '@/lib/preventiveDecisionThresholds';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 try{
  const report=await loadPreventiveDecisionThresholds();
  return Response.json({ok:true,build:'V82',schemaVersion:'v82-preventive-decision-thresholds-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'preventive decision threshold load failed'},{status:500});
 }
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const report=await runPreventiveDecisionThresholdGovernor();
  return Response.json({ok:true,build:'V82',schemaVersion:'v82-preventive-decision-thresholds-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'preventive decision threshold update failed'},{status:500});
 }
}
