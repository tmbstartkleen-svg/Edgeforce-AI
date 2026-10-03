import {
 latestProductionCertification,runProductionCertification,saveProductionCertification
} from '@/lib/productionCertification';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const latest=await latestProductionCertification();
 return Response.json({ok:true,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const {searchParams}=new URL(req.url);
 const strict=searchParams.get('strict')==='1'||searchParams.get('strict')==='true';
 const report=await runProductionCertification({strict:strict||undefined});
 const persistence=await saveProductionCertification(report);
 return Response.json({ok:true,...report,persistence},{
  status:report.certified?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
