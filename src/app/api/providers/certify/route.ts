import {certifyConfiguredProviders,latestProviderCertification} from '@/lib/providerCertification';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const secret=process.env.INGEST_SECRET;
 return !secret||req.headers.get('authorization')===`Bearer ${secret}`;
}

export async function GET(){
 const latest=await latestProviderCertification();
 return Response.json({ok:true,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const report=await certifyConfiguredProviders();
 return Response.json(report,{status:report.launchReady?200:422,headers:{'Cache-Control':'no-store'}});
}
