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
  source:body.source?String(body.source):null,
  topology:body.topology==='cloudflare-primary-vercel-standby'?'cloudflare-primary-vercel-standby':'dual-active',
  standby:body.standby&&typeof body.standby==='object'?{
   deploymentUrl:String(body.standby.deploymentUrl||''),
   deploymentId:body.standby.deploymentId?String(body.standby.deploymentId):null,
   commitSha:body.standby.commitSha?String(body.standby.commitSha):null,
   state:body.standby.state?String(body.standby.state):null,
   healthy:body.standby.healthy===true,
   manualOnly:body.standby.manualOnly===true,
   healthStatus:Number(body.standby.healthStatus||0)||null
  }:null,
  exactMainCertified:body.exactMainCertified===true,
  hostedSmokePassed:body.hostedSmokePassed===true,
  platformReady:body.platformReady===true
 });
 const invalid=Array.isArray((report as any)?.blockers)&&(report as any).blockers.length>0;
 return Response.json({ok:!invalid,report},{status:invalid?422:200,headers:{'Cache-Control':'no-store'}});
}
