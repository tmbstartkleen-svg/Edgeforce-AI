import {latestReleaseRollbackReconciliation,reconcileReleaseRollback} from '@/lib/releaseRollbackReconciliation';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const latest=await latestReleaseRollbackReconciliation();
 return Response.json({ok:true,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};try{body=await req.json()}catch{}
 const report=await reconcileReleaseRollback({
  failedCommitSha:String(body.failedCommitSha||''),
  failedDeploymentUrl:String(body.failedDeploymentUrl||''),
  restoredDeploymentId:body.restoredDeploymentId?String(body.restoredDeploymentId):null,
  restoredDeploymentUrl:body.restoredDeploymentUrl?String(body.restoredDeploymentUrl):null,
  platform:String(body.platform||''),
  source:String(body.source||'rollback-reconciliation'),
  workflowRunId:body.workflowRunId?String(body.workflowRunId):null,
  workflowRunAttempt:body.workflowRunAttempt?String(body.workflowRunAttempt):null,
  launchId:body.launchId?String(body.launchId):null
 });
 return Response.json({ok:report.rollbackConfirmed,...report},{
  status:report.rollbackConfirmed?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
