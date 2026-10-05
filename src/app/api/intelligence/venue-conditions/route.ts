import {loadVenueConditionSummary,rebuildVenueConditionProfiles} from '@/lib/venueWeatherIntelligence';

export const dynamic='force-dynamic';

export async function GET(){
 try{return Response.json({ok:true,build:'V68',schemaVersion:'v68-venue-conditions-1',...(await loadVenueConditionSummary())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'venue condition summary failed'},{status:500})}
}

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 try{return Response.json({ok:true,build:'V68',schemaVersion:'v68-venue-conditions-1',...(await rebuildVenueConditionProfiles())},{headers:{'Cache-Control':'no-store'}})}
 catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'venue condition rebuild failed'},{status:500})}
}
