import {db} from './db';
import type {Scanned} from './scanner';
import {buildProbabilitySet} from './parlays';

function weekStart(d=new Date()){
  const x=new Date(d);
  const day=(x.getUTCDay()+6)%7;
  x.setUTCDate(x.getUTCDate()-day);
  x.setUTCHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}

export type WeeklyDraftLeg={
  marketId:string;
  sport:string;
  event:string;
  selection:string;
  market:string;
  startTime:string;
  odds:number;
  simProbability:number;
  locked:boolean;
};

export async function getWeeklyDraft(){
  const sql=db();
  const week=weekStart();
  if(!sql)return {configured:false,week,legs:[] as WeeklyDraftLeg[],combinedProbability:null};
  const rows=await sql`
    select market_id as "marketId",sport,event,selection,market,start_time as "startTime",odds,
      sim_probability::float as "simProbability",locked
    from weekly_parlay_legs where week_start=${week}
    order by created_at asc
  ` as unknown as WeeklyDraftLeg[];
  const pseudo=rows.map((r,i)=>({
    id:r.marketId,sport:r.sport,league:r.sport,event:r.event,selection:r.selection,market:r.market,startTime:r.startTime,
    home:'',away:'',odds:r.odds,marketProb:r.simProbability,modelProb:r.simProbability,confidence:.7,sourceAgeMin:0,period:'PM' as const,
    fairOdds:0,edge:0,expectedValue:0,kelly:0,quarterKelly:0,recommendedStake:0,agreement:.8,sportModelProbability:r.simProbability,sportAdjustment:0,sportFactors:[],grade:'STRONG' as const,
    simulationRuns:10000,simProbability:r.simProbability,simCi:[r.simProbability,r.simProbability] as [number,number],daysOut:i,bucket:'WEEK' as const,freshness:'FRESH' as const,simulationMode:'event-monte-carlo' as const
  }));
  const summary=pseudo.length>=2?buildProbabilitySet(pseudo,pseudo.length):null;
  return {configured:true,week,legs:rows,combinedProbability:summary?.combinedProbability??(rows.length===1?rows[0].simProbability:null)};
}

export async function addWeeklyLeg(row:Scanned){
  const sql=db();
  if(!sql)return {ok:false,error:'Database is not configured'};
  const week=weekStart();
  await sql`
    insert into weekly_parlay_legs(week_start,market_id,sport,event,selection,market,start_time,odds,sim_probability,locked,raw)
    values(${week},${row.id},${row.sport},${row.event},${row.selection},${row.market},${row.startTime},${row.odds},${row.simProbability},false,${sql.json(row as any)})
    on conflict (week_start,market_id) do update set odds=excluded.odds,sim_probability=excluded.sim_probability,raw=excluded.raw
  `;
  return {ok:true};
}

export async function updateWeeklyLeg(marketId:string,action:'remove'|'lock'|'unlock'){
  const sql=db();
  if(!sql)return {ok:false,error:'Database is not configured'};
  const week=weekStart();
  if(action==='remove')await sql`delete from weekly_parlay_legs where week_start=${week} and market_id=${marketId} and locked=false`;
  else await sql`update weekly_parlay_legs set locked=${action==='lock'} where week_start=${week} and market_id=${marketId}`;
  return {ok:true};
}
