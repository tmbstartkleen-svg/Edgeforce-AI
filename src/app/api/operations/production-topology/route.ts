import {getProductionTopologyStatus} from '@/lib/productionTopologyWatchdog';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await getProductionTopologyStatus();
 return Response.json(report,{status:report.ready?200:503,headers:{'Cache-Control':'no-store','x-edgeforce-production-topology':'v146'}});
}
