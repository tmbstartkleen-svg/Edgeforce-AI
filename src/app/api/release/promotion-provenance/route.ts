import {
 currentReleasePromotionProvenance,evaluateReleasePromotionEvidence,
 latestReleasePromotionProvenance,saveReleasePromotionProvenance,
 type ReleasePromotionEvidence
} from '@/lib/releasePromotionProvenance';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const [current,latest]=await Promise.all([
  currentReleasePromotionProvenance(),
  latestReleasePromotionProvenance()
 ]);
 return Response.json({ok:true,current,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};try{body=await req.json()}catch{}
 const evidence:ReleasePromotionEvidence={
  releaseVersion:String(body.releaseVersion||''),
  modelVersion:String(body.modelVersion||''),
  migrationVersion:Number(body.migrationVersion||0),
  commitSha:String(body.commitSha||''),
  platform:String(body.platform||''),
  deploymentUrl:String(body.deploymentUrl||''),
  deploymentId:body.deploymentId?String(body.deploymentId):null,
  source:String(body.source||'unknown'),
  workflowRunId:body.workflowRunId?String(body.workflowRunId):null,
  workflowRunAttempt:body.workflowRunAttempt?String(body.workflowRunAttempt):null,
  executionCertified:body.executionCertified===true,
  strictCertified:body.strictCertified===true,
  canaryPassed:body.canaryPassed===true,
  v1Ready:body.v1Ready===true,
  promoted:body.promoted===true,
  rolledBack:body.rolledBack===true,
  evidence:body.evidence&&typeof body.evidence==='object'?body.evidence:{}
 };
 const report=evaluateReleasePromotionEvidence(evidence);
 const persistence=await saveReleasePromotionProvenance(report);
 return Response.json({ok:report.certified,...report,persistence},{
  status:report.certified?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
