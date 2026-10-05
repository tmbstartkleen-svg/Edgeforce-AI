import {loadReliabilitySummary,runIntelligenceReliabilitySupervisor} from '@/lib/intelligenceReliability';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V72',schemaVersion:'v72-reliability-1',...(await loadReliabilitySummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'reliability summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{
  const result=await runIntelligenceReliabilitySupervisor();
  return Response.json({ok:result.mode!=='PROTECTIVE',build:'V72',schemaVersion:'v72-reliability-1',...result},{status:result.mode==='PROTECTIVE'?503:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'reliability supervisor failed'},{status:500})}
}
