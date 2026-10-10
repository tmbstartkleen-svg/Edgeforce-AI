import {easternDay,loadSchedule,SCHEDULE_BATCH_SIZE} from '@/lib/gameSchedule';
import {ESPN_SCOREBOARD_FEEDS} from '@/lib/sportRegistry';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 const offset=Number(query.get('day')||0),batch=Number(query.get('batch')||0),sport=query.get('sport')||undefined;
 if(!Number.isInteger(offset)||offset<0||offset>6||!Number.isInteger(batch)||batch<0||batch>=Math.ceil(ESPN_SCOREBOARD_FEEDS.length/SCHEDULE_BATCH_SIZE)||(sport&&!ESPN_SCOREBOARD_FEEDS.some(f=>f.id===sport)))return Response.json({error:'Invalid schedule range or sport'},{status:400});
 return Response.json(await loadSchedule(easternDay(offset),batch,sport),{headers:{'Cache-Control':'public, max-age=30'}});
}
