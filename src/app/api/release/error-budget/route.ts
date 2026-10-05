import {loadSloGovernorSummary,runSloGovernor} from '@/lib/sloGovernor';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 try{
  const report=await loadSloGovernorSummary();
  return Response.json({ok:true,build:'V74',schemaVersion:'v74-slo-governor-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'SLO governor summary failed'},{status:500});
 }
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const report=await runSloGovernor();
  return Response.json({ok:report.deploymentAllowed,build:'V74',schemaVersion:'v74-slo-governor-1',...report},{
   status:report.deploymentAllowed?200:503,
   headers:{'Cache-Control':'no-store'}
  });
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'SLO governor failed'},{status:500});
 }
}
