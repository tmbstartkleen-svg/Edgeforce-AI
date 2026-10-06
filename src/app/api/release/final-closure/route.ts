import {evaluateFinalProductionClosure,latestFinalProductionClosure,saveFinalProductionClosure} from '@/lib/finalProductionClosure';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 return Response.json({ok:true,latest:await latestFinalProductionClosure()},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};try{body=await req.json()}catch{}
 const report=await evaluateFinalProductionClosure({
  commitSha:String(body.commitSha||process.env.DEPLOYMENT_COMMIT||process.env.VERCEL_GIT_COMMIT_SHA||''),
  source:body.source?String(body.source):'final-production-closure-api',
  workflowRunId:body.workflowRunId?String(body.workflowRunId):null
 });
 const persistence=await saveFinalProductionClosure(report);
 return Response.json({ok:true,closed:report.closed,report,persistence},{status:report.closed?200:202,headers:{'Cache-Control':'no-store'}});
}
