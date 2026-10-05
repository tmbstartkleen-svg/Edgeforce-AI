import {buildUnifiedIntelligenceCertification,latestUnifiedIntelligenceCertification,persistUnifiedIntelligenceCertification} from '@/lib/unifiedIntelligence';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}
export async function GET(){
 const [current,latest]=await Promise.all([buildUnifiedIntelligenceCertification(),latestUnifiedIntelligenceCertification()]);
 return Response.json({ok:current.state!=='BLOCKED',build:'V71',schemaVersion:'v71-unified-intelligence-1',current,latest},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const current=await buildUnifiedIntelligenceCertification();
 const persistence=await persistUnifiedIntelligenceCertification(current);
 return Response.json({ok:current.state!=='BLOCKED',build:'V71',schemaVersion:'v71-unified-intelligence-1',current,persistence},{
  status:current.state==='BLOCKED'?503:200,headers:{'Cache-Control':'no-store'}
 });
}
