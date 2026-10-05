import {buildDailyEdgePlan} from '@/lib/adaptiveRouter';

export const dynamic='force-dynamic';

export async function GET(){
 const plan=await buildDailyEdgePlan();
 return Response.json({ok:true,...plan},{headers:{'Cache-Control':'no-store'}});
}
