import {getProductionLaunchStatus,PRODUCTION_LAUNCH_STAGES,recordProductionLaunchEvent,type ProductionLaunchStage} from '@/lib/productionLaunch';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function GET(){
 const status=await getProductionLaunchStatus();
 return Response.json({ok:true,...status},{headers:{'Cache-Control':'no-store, max-age=0'}});
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));
 const launchId=String(body.launchId||'').trim();
 const stage=String(body.stage||'').trim() as ProductionLaunchStage;
 if(!launchId)return Response.json({ok:false,error:'launchId required'},{status:400});
 if(!PRODUCTION_LAUNCH_STAGES.includes(stage))return Response.json({ok:false,error:'invalid stage'},{status:400});
 const event=await recordProductionLaunchEvent({
  launchId,
  stage,
  deploymentUrl:body.deploymentUrl?String(body.deploymentUrl):null,
  commitSha:body.commitSha?String(body.commitSha):null,
  detail:body.detail&&typeof body.detail==='object'?body.detail:null
 });
 const status=await getProductionLaunchStatus();
 return Response.json({ok:true,event,...status},{headers:{'Cache-Control':'no-store, max-age=0'}});
}
