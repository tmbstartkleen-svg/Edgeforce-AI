import {loadSloGovernorSummary,runSloGovernor} from '@/lib/sloGovernor';
import {recordAutomationRun} from '@/lib/automationHealth';

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
 const started=Date.now();
 try{
  const report=await runSloGovernor();
  await recordAutomationRun('slo-governor','success',started,{
   state:report.state,deploymentAllowed:report.deploymentAllowed,
   oneHourBurn:report.windows.oneHour.burnRate,twentyFourHourBurn:report.windows.twentyFourHour.burnRate
  });
  return Response.json({ok:report.deploymentAllowed,build:'V74',schemaVersion:'v74-slo-governor-1',...report},{
   status:report.deploymentAllowed?200:503,
   headers:{'Cache-Control':'no-store'}
  });
 }catch(error){
  const message=error instanceof Error?error.message:'SLO governor failed';
  await recordAutomationRun('slo-governor','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500});
 }
}
