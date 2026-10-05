import {loadCrossSportOptimizerSummary,rebuildCrossSportOptimizerProfiles} from '@/lib/crossSportOptimizer';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V70',schemaVersion:'v70-cross-sport-optimizer-1',...(await loadCrossSportOptimizerSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'optimizer summary failed'},{status:500})}
}
export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V70',schemaVersion:'v70-cross-sport-optimizer-1',...(await rebuildCrossSportOptimizerProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'optimizer rebuild failed'},{status:500})}
}
