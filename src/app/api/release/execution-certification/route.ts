import {
 currentReleaseExecutionCertification,evaluateReleaseExecutionCertification,
 latestReleaseExecutionCertification,saveReleaseExecutionCertification,
 type ReleaseExecutionEvidence
} from '@/lib/releaseExecutionCertification';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const [current,latest]=await Promise.all([
  currentReleaseExecutionCertification(),
  latestReleaseExecutionCertification()
 ]);
 return Response.json({ok:true,current,latest},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 let body:any={};
 try{body=await req.json()}catch{}
 const evidence:ReleaseExecutionEvidence={
  releaseVersion:String(body.releaseVersion||''),
  modelVersion:String(body.modelVersion||''),
  migrationVersion:Number(body.migrationVersion||0),
  commitSha:String(body.commitSha||''),
  source:String(body.source||'unknown'),
  lintPassed:body.lintPassed===true,
  typecheckPassed:body.typecheckPassed===true,
  buildPassed:body.buildPassed===true,
  migrationPassed:body.migrationPassed===true,
  auditPassed:body.auditPassed===true,
  smokePassed:body.smokePassed===true,
  loadPassed:body.loadPassed===true,
  mlCompilePassed:body.mlCompilePassed===true,
  remoteSmokePassed:body.remoteSmokePassed===true,
  evidence:body.evidence&&typeof body.evidence==='object'?body.evidence:{}
 };
 const report=evaluateReleaseExecutionCertification(evidence);
 const persistence=await saveReleaseExecutionCertification(report);
 return Response.json({ok:report.certified,...report,persistence},{
  status:report.certified?200:503,
  headers:{'Cache-Control':'no-store'}
 });
}
