import {db} from './db';
import type {Market} from './types';

export type LinePoint={odds:number;pulledAt:string|Date};
export type LineMovementSummary={
 marketId:string; market:string; selection:string; openerOdds:number; currentOdds:number;
 openerProbability:number; currentProbability:number; probabilityMove:number; oddsMove:number;
 snapshotCount:number; firstSeenAt:string; lastSeenAt:string; moveWindowMin:number;
 direction:'TOWARD'|'AWAY'|'FLAT'; steam:boolean; steamStrength:'NONE'|'WATCH'|'STRONG';
};
type SnapshotRow={eventId:string;marketKey:string;selectionKey:string;odds:number;probability:number;pulledAt:string};
const key=(eventId:string,market:string,selection:string)=>[eventId,market,selection].join('|');

export function movement(points:LinePoint[]){
 if(points.length<2)return {direction:'FLAT',deltaOdds:0,velocityPerHour:0};
 const sorted=[...points].sort((a,b)=>new Date(a.pulledAt).getTime()-new Date(b.pulledAt).getTime());
 const oldest=sorted[0],newest=sorted[sorted.length-1];
 const delta=newest.odds-oldest.odds;
 const hours=Math.max(.01,(new Date(newest.pulledAt).getTime()-new Date(oldest.pulledAt).getTime())/3600000);
 return {direction:delta>3?'UP':delta<-3?'DOWN':'FLAT',deltaOdds:delta,velocityPerHour:delta/hours};
}

export async function loadLineMovement(markets:Market[]):Promise<Map<string,LineMovementSummary>>{
 const sql=db();
 if(!sql||!markets.length)return new Map();
 const ids=[...new Set(markets.map(x=>x.id))];
 const rows=await sql`
  select ms.event_id as "eventId",ms.market_key as "marketKey",ms.selection_key as "selectionKey",
   ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,ms.pulled_at as "pulledAt"
  from market_snapshots ms
  where ms.event_id in (select value from jsonb_array_elements_text(${sql.json(ids)}::jsonb))
  order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at asc
 `;
 const groups=new Map<string,SnapshotRow[]>();
 for(const row of rows as any[]){
  const k=key(String(row.eventId),String(row.marketKey),String(row.selectionKey));
  const list=groups.get(k)||[];
  list.push({eventId:String(row.eventId),marketKey:String(row.marketKey),selectionKey:String(row.selectionKey),odds:Number(row.odds),probability:Number(row.probability),pulledAt:new Date(row.pulledAt).toISOString()});
  groups.set(k,list);
 }
 const out=new Map<string,LineMovementSummary>();
 for(const market of markets){
  const list=groups.get(key(market.id,market.market,market.selection))||[];
  if(!list.length)continue;
  const first=list[0],last=list[list.length-1];
  const probabilityMove=last.probability-first.probability;
  const recentCutoff=new Date(last.pulledAt).getTime()-30*60000;
  const recent=list.filter(x=>new Date(x.pulledAt).getTime()>=recentCutoff);
  const recentMove=last.probability-(recent[0]?.probability??first.probability);
  const steam=Math.abs(recentMove)>=.02&&recent.length>=2;
  const steamStrength=Math.abs(recentMove)>=.035&&recent.length>=3?'STRONG':steam?'WATCH':'NONE';
  out.set(market.id,{marketId:market.id,market:market.market,selection:market.selection,openerOdds:first.odds,currentOdds:last.odds,openerProbability:first.probability,currentProbability:last.probability,probabilityMove,oddsMove:last.odds-first.odds,snapshotCount:list.length,firstSeenAt:first.pulledAt,lastSeenAt:last.pulledAt,moveWindowMin:Math.max(.01,(new Date(last.pulledAt).getTime()-new Date(first.pulledAt).getTime())/60000),direction:Math.abs(probabilityMove)<.002?'FLAT':probabilityMove>0?'TOWARD':'AWAY',steam,steamStrength});
 }
 return out;
}

export async function loadRecentSteam(limit=100){
 const sql=db();
 if(!sql)return [];
 const rows=await sql`
  select ms.event_id as "eventId",ms.market_key as market,ms.selection_key as selection,min(ms.pulled_at) as "firstSeenAt",max(ms.pulled_at) as "lastSeenAt",count(*)::int as "snapshotCount",
   (array_agg(ms.american_odds order by ms.pulled_at asc))[1] as "openerOdds",(array_agg(ms.american_odds order by ms.pulled_at desc))[1] as "currentOdds",
   (array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at asc))[1]::float as "openerProbability",
   (array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at desc))[1]::float as "currentProbability"
  from market_snapshots ms join events e on e.id=ms.event_id
  where e.start_time>now() and e.start_time<=now()+interval '8 days' and ms.pulled_at>=now()-interval '24 hours'
  group by ms.event_id,ms.market_key,ms.selection_key having count(*)>=2
  order by abs((array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at desc))[1]-(array_agg(coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float order by ms.pulled_at asc))[1]) desc limit ${limit}
 `;
 return (rows as any[]).map(r=>{const probabilityMove=Number(r.currentProbability)-Number(r.openerProbability);return {...r,probabilityMove,oddsMove:Number(r.currentOdds)-Number(r.openerOdds),direction:Math.abs(probabilityMove)<.002?'FLAT':probabilityMove>0?'TOWARD':'AWAY',steam:Math.abs(probabilityMove)>=.02,steamStrength:Math.abs(probabilityMove)>=.035&&Number(r.snapshotCount)>=3?'STRONG':Math.abs(probabilityMove)>=.02?'WATCH':'NONE'};});
}

export async function backfillClosingOddsForSlip(betSlipId:string){
 const sql=db();
 if(!sql)return 0;
 const rows=await sql`
  update bet_legs bl set
   closing_odds=close_line.odds,
   closing_implied_probability=case when close_line.odds>0 then 100.0/(close_line.odds+100.0) else abs(close_line.odds)::float/(abs(close_line.odds)+100.0) end,
   clv_probability=(
    case when close_line.odds>0 then 100.0/(close_line.odds+100.0) else abs(close_line.odds)::float/(abs(close_line.odds)+100.0) end
   )-coalesce(
    bl.raw_implied_probability,
    case when bl.offered_odds>0 then 100.0/(bl.offered_odds+100.0) else abs(bl.offered_odds)::float/(abs(bl.offered_odds)+100.0) end
   )
  from lateral (select ms.american_odds as odds from market_snapshots ms join events e on e.id=ms.event_id where ms.event_id=bl.event_id and lower(ms.market_key)=lower(bl.market_type) and lower(ms.selection_key)=lower(bl.selection) and ms.pulled_at<=e.start_time order by ms.pulled_at desc limit 1) close_line
  where bl.bet_slip_id=${betSlipId} and bl.closing_odds is null and bl.event_id is not null returning bl.ordinal
 `;
 await sql`
  update bet_legs set
   closing_implied_probability=case when closing_odds>0 then 100.0/(closing_odds+100.0) else abs(closing_odds)::float/(abs(closing_odds)+100.0) end,
   clv_probability=(case when closing_odds>0 then 100.0/(closing_odds+100.0) else abs(closing_odds)::float/(abs(closing_odds)+100.0) end)-coalesce(raw_implied_probability,case when offered_odds>0 then 100.0/(offered_odds+100.0) else abs(offered_odds)::float/(abs(offered_odds)+100.0) end)
  where bet_slip_id=${betSlipId} and closing_odds is not null and offered_odds is not null
 `;
 return rows.length;
}

export async function closingLineForMarket(eventId:string,marketKey:string,selectionKey:string){
 const sql=db(); if(!sql)return null;
 const rows=await sql`select ms.american_odds as odds,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as probability,ms.pulled_at as "pulledAt" from market_snapshots ms join events e on e.id=ms.event_id where ms.event_id=${eventId} and lower(ms.market_key)=lower(${marketKey}) and lower(ms.selection_key)=lower(${selectionKey}) and ms.pulled_at<=e.start_time order by ms.pulled_at desc limit 1`;
 return rows[0]||null;
}
