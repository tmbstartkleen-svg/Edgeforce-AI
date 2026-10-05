import {buildV1ReleaseReadiness,persistV1ReleaseReadiness} from '@/lib/v1ReleaseReadiness';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(req:Request){
 const url=new URL(req.url);
 const strict=url.searchParams.get('strict')==='1'||url.searchParams.get('strict')==='true';
 const report=await buildV1ReleaseReadiness({strict:strict||undefined});
 return Response.json({ok:report.verdict!=='NO_GO',...report},{
  status:report.verdict==='NO_GO'&&strict?503:200,
  headers:{'Cache-Control':'no-store, max-age=0'}
 });
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const url=new URL(req.url);
 const strict=url.searchParams.get('strict')==='1'||url.searchParams.get('strict')==='true';
 const report=await buildV1ReleaseReadiness({strict:strict||undefined});
 const persistence=await persistV1ReleaseReadiness(report);
 return Response.json({ok:report.verdict!=='NO_GO',persisted:persistence.persisted,persistenceId:persistence.id,...report},{
  status:report.verdict==='NO_GO'?503:200,
  headers:{'Cache-Control':'no-store, max-age=0'}
 });
}
