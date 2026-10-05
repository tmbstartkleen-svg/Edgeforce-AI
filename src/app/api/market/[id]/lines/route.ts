import {db} from '@/lib/db';
import {canonicalMovementMarket,canonicalMovementSelection} from '@/lib/marketMovementLearning';

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {searchParams}=new URL(req.url);
 const market=searchParams.get('market');
 const selection=searchParams.get('selection');
 const sql=db();
 if(!sql)return Response.json({source:'none',points:[]});
 const events=await sql`
  select sport,home_team_id as home,away_team_id as away,start_time as "startTime"
  from events where id=${id} limit 1
 `;
 const event=(events as any[])[0];
 if(!event)return Response.json({source:'database',points:[]});
 const rows=await sql`
  select ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
   ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "impliedProbability",
   ms.pulled_at as "pulledAt"
  from market_snapshots ms join events e on e.id=ms.event_id
  where lower(e.sport)=lower(${String(event.sport)})
   and lower(coalesce(e.home_team_id,''))=lower(${String(event.home||'')})
   and lower(coalesce(e.away_team_id,''))=lower(${String(event.away||'')})
   and abs(extract(epoch from (e.start_time-${new Date(event.startTime).toISOString()}::timestamptz)))<=600
   and ms.pulled_at<=least(e.start_time,now())
  order by ms.pulled_at asc
  limit 2000
 `;
 const canonicalMarket=market?canonicalMovementMarket(market):null;
 const canonicalSelection=market&&selection?canonicalMovementSelection(selection,market):null;
 const points=(rows as any[]).filter(row=>{
  if(canonicalMarket&&canonicalMovementMarket(String(row.marketKey))!==canonicalMarket)return false;
  if(canonicalSelection&&canonicalMovementSelection(String(row.selectionKey),String(row.marketKey))!==canonicalSelection)return false;
  return true;
 }).map(row=>({...row,point:(String(row.selectionKey).match(/(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*$/)?.[1]??null)}));
 return Response.json({source:'database',canonical:true,points},{headers:{'Cache-Control':'no-store'}});
}
