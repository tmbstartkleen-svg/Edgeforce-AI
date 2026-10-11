import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders,normalizeNetworkMarkets,type RawNetworkMarket} from '@/lib/firstPartySportsNetwork';

export const dynamic='force-dynamic';
const MAX_SCAN=750,TTL_MS=30000;
type Row={
 eventId:string;sport:string;league:string;home:string;away:string;
 startTime:string|Date;market:string;selection:string;odds:number;
 bookmaker:string;provider:string;sourceTimestamp:string|null;
 pulledAt:string|Date;priorAgeMin:string|null;
};
// Cache only immutable detached observations, never request-scoped database clients or promises.
const snapshots=new Map<string,{at:number;rows:RawNetworkMarket[]}>();
const error=(status:string,code:number)=>Response.json({ok:false,status,markets:[]},{status:code,headers:networkHeaders});

export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const url=new URL(request.url);
 const sport=(url.searchParams.get('sport')||'').trim();
 const rawLimit=url.searchParams.get('limit')||'60';
 if(sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport))return error('INVALID_SPORT',400);
 if(!/^\d{1,3}$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100)return error('INVALID_LIMIT',400);
 const limit=Number(rawLimit),key=sport.toLowerCase()||'*',now=Date.now();
 const cached=snapshots.get(key);
 let rows=cached&&now-cached.at<TTL_MS?cached.rows:null;
 if(!rows){
  const sql=db();if(!sql)return error('DATABASE_NOT_CONFIGURED',503);
  try{
   const dbRows=await sql<Row[]>`
    select ms.event_id as "eventId",e.sport,e.league,
     e.home_team_id as home,e.away_team_id as away,
     e.start_time as "startTime",ms.market_key as market,
     ms.selection_key as selection,ms.american_odds as odds,
     ms.bookmaker,ms.provider,
     nullif(ms.raw->>'sourceTimestamp','') as "sourceTimestamp",
     ms.pulled_at as "pulledAt",
     ms.raw->>'sourceAgeMin' as "priorAgeMin"
    from market_snapshots ms
    join events e on e.id=ms.event_id
    where e.start_time>now() and e.start_time<now()+interval '8 days'
     and ms.pulled_at>now()-interval '24 hours'
     and (${sport}='' or lower(e.sport)=lower(${sport}))
    order by ms.pulled_at desc
    limit ${MAX_SCAN}
   `;
   rows=dbRows.map(row=>({
    ...row,odds:Number(row.odds),
    startTime:new Date(row.startTime).toISOString(),
    pulledAt:new Date(row.pulledAt).toISOString()
   }));
   if(snapshots.size>=6)snapshots.delete(snapshots.keys().next().value!);
   snapshots.set(key,{rows,at:Date.now()});
  }catch{return error('MARKET_SNAPSHOT_DATABASE_UNAVAILABLE',503);}
 }
 const result=normalizeNetworkMarkets(rows,Date.now(),limit,sport);
 return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v1',...result},
  {headers:networkHeaders});
}
