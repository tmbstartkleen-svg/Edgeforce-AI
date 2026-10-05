import {loadPreventiveActionLearningSummary,recordPreventiveAction,runPreventiveActionLearning} from '@/lib/preventiveActionLearning';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 try{
  const report=await loadPreventiveActionLearningSummary();
  return Response.json({ok:true,build:'V78',schemaVersion:'v78-preventive-action-learning-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'preventive action learning failed'},{status:500});
 }
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const body=await req.json().catch(()=>({}));
  if(body?.mode==='learn'){
   const report=await runPreventiveActionLearning();
   return Response.json({ok:true,build:'V78',schemaVersion:'v78-preventive-action-learning-1',...report});
  }
  const cause=String(body?.cause||'').trim();
  const actionText=String(body?.actionText||'').trim();
  const sourceRiskScore=Number(body?.sourceRiskScore||0);
  const sourceRiskLevel=String(body?.sourceRiskLevel||'LOW');
  if(!cause||!actionText)return Response.json({ok:false,error:'cause and actionText are required'},{status:400});
  const result=await recordPreventiveAction({cause,actionText,sourceRiskScore,sourceRiskLevel,appliedBy:body?.appliedBy?String(body.appliedBy):null});
  return Response.json({ok:true,build:'V78',schemaVersion:'v78-preventive-action-learning-1',...result});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'preventive action recording failed'},{status:500});
 }
}
