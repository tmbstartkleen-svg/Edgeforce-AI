import {buildSkillRatings} from '@/lib/skillRatings';

export const dynamic='force-dynamic';

export async function GET(){
 const report=await buildSkillRatings();
 return Response.json({ok:true,...report},{headers:{'Cache-Control':'no-store'}});
}
