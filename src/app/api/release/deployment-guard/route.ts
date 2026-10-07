import {captureDeploymentGuardSnapshot,evaluateDeploymentGuard,loadDeploymentGuardSummary,normalizeDeploymentBaseline,persistDeploymentGuardRun} from '@/lib/deploymentGuard';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const [snapshot,history]=await Promise.all([captureDeploymentGuardSnapshot(),loadDeploymentGuardSummary()]);
 return Response.json({ok:true,build:'V73',schemaVersion:'v73-deployment-guard-1',snapshot,...history},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));
 if(!body.baseline)return Response.json({ok:false,error:'baseline required'},{status:400});
 const baseline=normalizeDeploymentBaseline(body.baseline);
 const candidate=await captureDeploymentGuardSnapshot();
 const result=evaluateDeploymentGuard(baseline,candidate,{legacyHandoff:body.legacyHandoff===true});
 const persistence=await persistDeploymentGuardRun({launchId:body.launchId?String(body.launchId):null,baseline,candidate,result});
 return Response.json({ok:result.decision==='PASS',build:'V73',schemaVersion:'v73-deployment-guard-1',baseline,candidate,...result,persistence},{
  status:200,
  headers:{'Cache-Control':'no-store'}
 });
}
