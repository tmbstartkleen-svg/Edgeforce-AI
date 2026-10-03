import {getAutomationHealth} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(){
 const health=await getAutomationHealth();
 return Response.json({ok:true,...health},{headers:{'Cache-Control':'no-store'}});
}
