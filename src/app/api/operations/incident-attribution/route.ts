import {loadIncidentAttributionSummary,persistIncidentAttribution} from '@/lib/incidentAttribution';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 try{
  const report=await loadIncidentAttributionSummary();
  return Response.json({ok:true,build:'V75',schemaVersion:'v75-incident-attribution-1',...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'incident attribution failed'},{status:500});
 }
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const report=await loadIncidentAttributionSummary();
  const persisted=await persistIncidentAttribution(report);
  return Response.json({ok:true,build:'V75',schemaVersion:'v75-incident-attribution-1',...persisted,...report},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'incident attribution failed'},{status:500});
 }
}
