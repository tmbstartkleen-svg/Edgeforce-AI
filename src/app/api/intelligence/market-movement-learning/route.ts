import {loadMarketMovementLearningSummary,rebuildMarketMovementProfiles} from '@/lib/marketMovementLearning';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V69',schemaVersion:'v69-market-movement-1',...(await loadMarketMovementLearningSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'market movement summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V69',schemaVersion:'v69-market-movement-1',...(await rebuildMarketMovementProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'market movement rebuild failed'},{status:500})}
}
