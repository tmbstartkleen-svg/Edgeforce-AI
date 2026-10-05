import {loadLineupRedistributionSummary,rebuildLineupRedistributionProfiles} from '@/lib/lineupRoleRedistribution';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V65',schemaVersion:'v65-lineup-redistribution-1',...(await loadLineupRedistributionSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'lineup redistribution summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V65',schemaVersion:'v65-lineup-redistribution-1',...(await rebuildLineupRedistributionProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'lineup redistribution rebuild failed'},{status:500})}
}
