import {loadPropPerformance} from '@/lib/playerWarehouse';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await loadPropPerformance();
 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  report
 },{headers:{'Cache-Control':'no-store'}});
}
