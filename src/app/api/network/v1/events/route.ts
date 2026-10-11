import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';

export const dynamic='force-dynamic';
type EventRow={
 id:string;sport:string;league:string;home:string;away:string;
 startTime:Date|string;status:string;latestObserved:Date|string|null;
};
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const search=new URL(request.url).searchParams;
 const sport=(search.get('sport')||'').trim();
 const limitRaw=search.get('limit')||'50';
 if(sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport)||
   !/^\d{1,3}$/.test(limitRaw)||Number(limitRaw)<1||Number(limitRaw)>100)
  return Response.json({ok:false,status:'INVALID_QUERY'},{status:400,headers:networkHeaders});
 const sql=db();
 if(!sql)return Response.json({ok:false,status:'DATABASE_NOT_CONFIGURED',events:[]},
  {status:503,headers:networkHeaders});
 try{
  const limit=Number(limitRaw);
  const events=await sql<EventRow[]>`
   select e.id,e.sport,e.league,e.home_team_id as home,e.away_team_id as away,
    e.start_time as "startTime",e.status,
    (select max(ms.pulled_at) from market_snapshots ms where ms.event_id=e.id) as "latestObserved"
   from events e
   where e.start_time>now() and e.start_time<now()+interval '8 days'
    and (${sport}='' or lower(e.sport)=lower(${sport}))
   order by e.start_time asc
   limit ${limit}
  `;
  return Response.json({
   ok:true,network:'EdgeForce Sports Network',version:'v1',
   role:'STORED_SCHEDULE_RESEARCH',updatedAt:new Date().toISOString(),
   eventCount:events.length,
   warning:'Upcoming events are stored observations and may be incomplete. No live score, league verification, executable odds or official fixture license is implied.',
   events:events.map(e=>({
    eventId:e.id,sport:e.sport,league:e.league,
    home:e.home,away:e.away,startTime:new Date(e.startTime).toISOString(),
    scheduleStatus:e.status,sourceMarketObservedAt:e.latestObserved?new Date(e.latestObserved).toISOString():null,
    liveScoreAvailable:false,executable:false
   }))
  },{headers:networkHeaders});
 }catch{
  return Response.json({ok:false,status:'SCHEDULE_DATABASE_UNAVAILABLE',events:[]},
   {status:503,headers:networkHeaders});
 }
}
