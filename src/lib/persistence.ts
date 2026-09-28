import {db} from './db';
import type {Market} from './types';

export async function saveMarketSnapshots(markets:Market[],provider='authorized-provider',bookmaker='DraftKings'){
  const sql=db();
  if(!sql)return {written:0,mode:'memory' as const};
  let written=0;
  for(const m of markets){
    await sql`
      insert into events(id,provider_event_id,sport,league,home_team_id,away_team_id,start_time,status)
      values(${m.id},${m.id},${m.sport},${m.league},${m.home},${m.away},${m.startTime},'scheduled')
      on conflict (id) do update set start_time=excluded.start_time,status='scheduled'
    `;
    await sql`
      insert into market_snapshots(event_id,provider,bookmaker,market_key,selection_key,american_odds,implied_probability,no_vig_probability,source_age_seconds,raw)
      values(${m.id},${provider},${bookmaker},${m.market},${m.selection},${m.odds},${m.marketProb},${m.marketProb},${Math.round(m.sourceAgeMin*60)},${sql.json(m as any)})
    `;
    written++;
  }
  return {written,mode:'database' as const};
}

export async function latestStoredMarkets(limit=500):Promise<Market[]>{
  const sql=db();
  if(!sql)return [];
  const rows=await sql`
    select distinct on (ms.event_id,ms.market_key,ms.selection_key)
      ms.event_id as id,
      e.sport,
      e.league,
      coalesce(e.away_team_id,'Away') || ' @ ' || coalesce(e.home_team_id,'Home') as event,
      ms.selection_key as selection,
      ms.market_key as market,
      e.start_time as "startTime",
      coalesce(e.home_team_id,'Home') as home,
      coalesce(e.away_team_id,'Away') as away,
      ms.american_odds as odds,
      coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "marketProb",
      coalesce((ms.raw->>'modelProb')::float,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float) as "modelProb",
      coalesce((ms.raw->>'confidence')::float,0.6) as confidence,
      greatest(0,extract(epoch from (now()-ms.pulled_at))/60)::float as "sourceAgeMin",
      case when extract(hour from e.start_time at time zone 'America/Chicago')<12 then 'AM' else 'PM' end as period,
      coalesce(ms.raw->'sportFeatures','{}'::jsonb) as "sportFeatures"
    from market_snapshots ms
    join events e on e.id=ms.event_id
    where e.start_time between now()-interval '2 hours' and now()+interval '8 days'
    order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at desc
    limit ${limit}
  `;
  return rows as unknown as Market[];
}

export async function lineHistory(eventId:string,marketKey:string,selectionKey:string,limit=100){
  const sql=db();
  if(!sql)return [];
  return sql`
    select american_odds as odds,pulled_at as "pulledAt",implied_probability as "impliedProbability"
    from market_snapshots
    where event_id=${eventId} and market_key=${marketKey} and selection_key=${selectionKey}
    order by pulled_at desc limit ${limit}
  `;
}

export async function recordModelRuns(rows:any[]){
  const sql=db();
  if(!sql)return 0;
  let n=0;
  for(const x of rows){
    await sql`
      insert into model_runs(
        event_id,market_key,selection_key,model_version,run_count,
        market_probability,model_probability,fair_american_odds,expected_value,
        full_kelly,fractional_kelly,agreement,confidence,grade,
        simulation_probability,simulation_ci_low,simulation_ci_high,feature_snapshot
      ) values(
        ${x.id},${x.market},${x.selection},${process.env.MODEL_VERSION||'edgeforce-v8'},${x.simulationRuns},
        ${x.marketProb},${x.modelProb},${x.fairOdds},${x.expectedValue},
        ${x.kelly},${x.recommendedStake},${x.agreement},${x.confidence},${x.grade},
        ${x.simProbability},${x.simCi?.[0]??null},${x.simCi?.[1]??null},
        ${sql.json({
          freshness:x.freshness,
          daysOut:x.daysOut,
          sportModelProbability:x.sportModelProbability,
          sportAdjustment:x.sportAdjustment,
          sportFactors:x.sportFactors,
          sportFeatures:x.sportFeatures||{}
        })}
      )
    `;
    n++;
  }
  return n;
}
