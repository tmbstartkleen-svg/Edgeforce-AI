import {buildProductionObservability,persistProductionObservability} from '@/lib/productionObservability';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildProductionObservability();
 const persistence=await persistProductionObservability(report);
 return Response.json({
  ok:report.overall!=='CRITICAL',
  analyticsOnly:true,
  persisted:persistence.persisted,
  ...report
 },{status:report.overall==='CRITICAL'?503:200,headers:{'Cache-Control':'no-store, max-age=0'}});
}
