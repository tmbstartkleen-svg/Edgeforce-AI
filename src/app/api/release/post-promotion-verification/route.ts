import {
 evaluatePostPromotionVerification,latestPostPromotionVerification,savePostPromotionVerification
} from '@/lib/postPromotionVerification';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const latest=await latestPostPromotionVerification();
 return Response.json({ok:true,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};try{body=await req.json()}catch{}
 const report=await evaluatePostPromotionVerification({
  deploymentUrl:String(body.deploymentUrl||''),
  platform:String(body.platform||''),
  source:String(body.source||'post-promotion-verification'),
  workflowRunId:body.workflowRunId?String(body.workflowRunId):null,
  runtime:body.runtime&&typeof body.runtime==='object'?body.runtime:{}
 });
 const persistence=await savePostPromotionVerification(report);
 return Response.json({ok:report.certified,...report,persistence},{
  status:report.certified?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
