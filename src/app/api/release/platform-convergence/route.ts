import {latestPlatformConvergence,recordPlatformEvidence} from '@/lib/releasePlatformConvergence';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const latest=await latestPlatformConvergence();
 return Response.json({ok:true,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};try{body=await req.json()}catch{}
 const report=await recordPlatformEvidence({
  platform:body.platform,
  deploymentUrl:String(body.deploymentUrl||''),
  version:String(body.version||''),
  modelVersion:String(body.modelVersion||''),
  migrationVersion:Number(body.migrationVersion||0),
  commitSha:String(body.commitSha||''),
  workflowRunId:body.workflowRunId?String(body.workflowRunId):null,
  source:body.source?String(body.source):null
 });
 return Response.json({ok:true,report},{headers:{'Cache-Control':'no-store'}});
}
