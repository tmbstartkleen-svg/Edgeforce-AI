import {db} from './db';
import type {Scanned} from './scanner';
import {buildProbabilitySet} from './parlays';
import {evaluateLegDecision,type LegDecisionStatus} from './legDecision';

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
  originalOdds:number;
  originalSimProbability:number;
  currentOdds:number;
  currentSimProbability:number;
  locked:boolean;
  needsReview:boolean;
  changeSummary:string[];
  decisionStatus:LegDecisionStatus;
  decisionScore:number;
  decisionReasons:string[];
  decisionUpdatedAt:string|null;
};

export async function getWeeklyDraft(){
  const sql=db();
  const week=weekStart();
  if(!sql)return {configured:false,week,legs:[] as WeeklyDraftLeg[],combinedProbability:null,decisionCounts:{KEEP:0,WATCH:0,REPLACE_CANDIDATE:0}};
  const rows=await sql`
    select market_id as "marketId",sport,event,selection,market,start_time as "startTime",odds,
      sim_probability::float as "simProbability",
      coalesce(original_odds,odds) as "originalOdds",
      coalesce(original_sim_probability,sim_probability)::float as "originalSimProbability",
      coalesce(current_odds,odds) as "currentOdds",
      coalesce(current_sim_probability,sim_probability)::float as "currentSimProbability",
      locked,coalesce(needs_review,false) as "needsReview",coalesce(change_summary,'[]'::jsonb) as "changeSummary",
      coalesce(decision_status,'KEEP') as "decisionStatus",coalesce(decision_score,50) as "decisionScore",
      coalesce(decision_reasons,'[]'::jsonb) as "decisionReasons",decision_updated_at as "decisionUpdatedAt"
    from weekly_parlay_legs where week_start=${week}
    order by created_at asc
  ` as unknown as WeeklyDraftLeg[];

  const pseudo=rows.map((r,i)=>({
    id:r.marketId,sport:r.sport,league:r.sport,event:r.event,selection:r.selection,market:r.market,startTime:r.startTime,
    home:'',away:'',odds:r.currentOdds,marketProb:r.currentSimProbability,modelProb:r.currentSimProbability,confidence:.7,sourceAgeMin:0,period:'PM' as const,
    fairOdds:0,edge:0,expectedValue:0,kelly:0,quarterKelly:0,recommendedStake:0,agreement:.8,sportModelProbability:r.currentSimProbability,sportAdjustment:0,sportFactors:[],grade:'STRONG' as const,
    simulationRuns:10000,simProbability:r.currentSimProbability,simCi:[r.currentSimProbability,r.currentSimProbability] as [number,number],daysOut:i,bucket:'WEEK' as const,freshness:'FRESH' as const,simulationMode:'event-monte-carlo' as const
  }));
  const summary=pseudo.length>=2?buildProbabilitySet(pseudo,pseudo.length):null;
  const decisionCounts={KEEP:0,WATCH:0,REPLACE_CANDIDATE:0};
  for(const row of rows)decisionCounts[row.decisionStatus]=(decisionCounts[row.decisionStatus]||0)+1;
  return {configured:true,week,legs:rows,combinedProbability:summary?.combinedProbability??(rows.length===1?rows[0].currentSimProbability:null),decisionCounts};
}

export async function addWeeklyLeg(row:Scanned){
  if(row.simProbability<.65)return {ok:false,error:'Weekly legs must be at least 65% in the 10,000-run simulation'};
  const sql=db();
  if(!sql)return {ok:false,error:'Database is not configured'};
  const week=weekStart();
  const decision=evaluateLegDecision({
    originalSimulationProbability:row.simProbability,
    currentSimulationProbability:row.simProbability,
    originalOdds:row.odds,currentOdds:row.odds,locked:false,changeSummary:[]
  });

  await sql`
    insert into weekly_parlay_legs(
      week_start,market_id,sport,event,selection,market,start_time,odds,sim_probability,locked,raw,
      original_odds,original_sim_probability,current_odds,current_sim_probability,needs_review,change_summary,
      decision_status,decision_score,decision_reasons,decision_updated_at
    ) values(
      ${week},${row.id},${row.sport},${row.event},${row.selection},${row.market},${row.startTime},${row.odds},${row.simProbability},false,${sql.json(row as any)},
      ${row.odds},${row.simProbability},${row.odds},${row.simProbability},false,'[]'::jsonb,
      ${decision.status},${decision.score},${sql.json(decision.reasons as any)},now()
    )
    on conflict (week_start,market_id) do update set
      current_odds=excluded.current_odds,
      current_sim_probability=excluded.current_sim_probability,
      odds=case when weekly_parlay_legs.locked then weekly_parlay_legs.odds else excluded.odds end,
      sim_probability=case when weekly_parlay_legs.locked then weekly_parlay_legs.sim_probability else excluded.sim_probability end,
      raw=excluded.raw,
      updated_at=now()
  `;
  return {ok:true};
}

export async function updateWeeklyLeg(marketId:string,action:'remove'|'lock'|'unlock'){
  const sql=db();
  if(!sql)return {ok:false,error:'Database is not configured'};
  const week=weekStart();
  if(action==='remove'){
    await sql`delete from weekly_parlay_legs where week_start=${week} and market_id=${marketId} and locked=false`;
  }else if(action==='lock'){
    await sql`update weekly_parlay_legs set locked=true,updated_at=now() where week_start=${week} and market_id=${marketId}`;
  }else{
    await sql`
      update weekly_parlay_legs set
        locked=false,
        odds=coalesce(current_odds,odds),
        sim_probability=coalesce(current_sim_probability,sim_probability),
        needs_review=false,
        change_summary='[]'::jsonb,
        updated_at=now()
      where week_start=${week} and market_id=${marketId}
    `;
  }
  return {ok:true};
}

export async function syncWeeklyDraftFromResimulation(rows:Scanned[],changes:Array<{marketId:string;reasons:string[]}>=[]){
  const sql=db();
  if(!sql)return {configured:false,updated:0,review:0,decisionCounts:{KEEP:0,WATCH:0,REPLACE_CANDIDATE:0}};
  const week=weekStart();
  const changeMap=new Map(changes.map(x=>[x.marketId,x.reasons]));
  let updated=0,review=0;
  const decisionCounts={KEEP:0,WATCH:0,REPLACE_CANDIDATE:0};

  for(const row of rows){
    const current=await sql`
      select coalesce(original_odds,odds) as "originalOdds",
        coalesce(original_sim_probability,sim_probability)::float as "originalSimProbability",
        locked
      from weekly_parlay_legs
      where week_start=${week} and market_id=${row.id}
      limit 1
    ` as unknown as Array<{originalOdds:number;originalSimProbability:number;locked:boolean}>;
    if(!current.length)continue;

    const reasons=changeMap.get(row.id)||[];
    const saved=current[0];
    const decision=evaluateLegDecision({
      originalSimulationProbability:saved.originalSimProbability,
      currentSimulationProbability:row.simProbability,
      originalOdds:saved.originalOdds,
      currentOdds:row.odds,
      locked:saved.locked,
      changeSummary:reasons
    });
    const needsReview=decision.status!=='KEEP';

    const result=await sql`
      update weekly_parlay_legs set
        current_odds=${row.odds},
        current_sim_probability=${row.simProbability},
        odds=case when locked then odds else ${row.odds} end,
        sim_probability=case when locked then sim_probability else ${row.simProbability} end,
        raw=${sql.json(row as any)},
        needs_review=${needsReview},
        change_summary=${sql.json(reasons as any)},
        decision_status=${decision.status},
        decision_score=${decision.score},
        decision_reasons=${sql.json(decision.reasons as any)},
        decision_updated_at=now(),
        updated_at=now()
      where week_start=${week} and market_id=${row.id}
      returning market_id
    `;
    if(result.length){
      updated++;
      decisionCounts[decision.status]++;
      if(needsReview)review++;
    }
  }
  return {configured:true,updated,review,decisionCounts};
}
