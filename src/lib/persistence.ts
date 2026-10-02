import {db} from './db';
import type {Market} from './types';

export async function saveMarketSnapshots(markets:Market[],provider='authorized-provider',bookmaker='DraftKings',integrityStatus='UNASSESSED'){
  const sql=db();
  if(!sql)return {written:0,mode:'memory' as const};
  let written=0;
  for(const m of markets){
    const eventId=m.eventId||m.id;
    await sql`
      insert into events(id,provider_event_id,sport,league,home_team_id,away_team_id,start_time,venue,status)
      values(${eventId},${eventId},${m.sport},${m.league},${m.home},${m.away},${m.startTime},${m.venue||null},'scheduled')
      on conflict (id) do update set start_time=excluded.start_time,status='scheduled',venue=coalesce(excluded.venue,events.venue)
    `;
    await sql`
      insert into market_snapshots(
        event_id,provider,bookmaker,market_key,selection_key,american_odds,point,
        raw_implied_probability,implied_probability,no_vig_probability,source_age_seconds,source_timestamp,data_quality,integrity_status,integrity_checked_at,raw
      ) values(
        ${eventId},${m.provider||provider},${m.bookmaker||bookmaker},${m.marketKey||m.market},${m.selection},${m.odds},${m.point??null},
        ${m.rawImpliedProb??m.marketProb},${m.rawImpliedProb??m.marketProb},${m.noVigProb??m.marketProb},${Math.round(m.sourceAgeMin*60)},${m.sourceTimestamp||null},${m.dataQuality??1},${integrityStatus},now(),${sql.json(m as any)}
      )
    `;
    written++;
  }
  return {written,mode:'database' as const};
}

export async function latestStoredMarkets(limit=1500):Promise<Market[]>{
  const sql=db();
  if(!sql)return [];
  const rows=await sql`
    select distinct on (ms.event_id,ms.bookmaker,ms.market_key,ms.selection_key,coalesce(ms.point,0))
      concat(ms.event_id,':',ms.market_key,':',ms.selection_key,':',coalesce(ms.point::text,'')) as id,
      ms.event_id as "eventId",
      e.sport,e.league,
      coalesce(e.away_team_id,'Away') || ' @ ' || coalesce(e.home_team_id,'Home') as event,
      ms.selection_key as selection,ms.market_key as "marketKey",
      case
        when lower(ms.market_key) in ('h2h','moneyline','ml') or lower(ms.market_key) like '%moneyline%' then 'Moneyline'
        when lower(ms.market_key) like '%spread%' or lower(ms.market_key) like '%run_line%' or lower(ms.market_key) like '%puck_line%' then 'Spread'
        when lower(ms.market_key) like '%total%' and lower(ms.market_key) not like '%player%' then 'Total'
        when lower(ms.market_key) like '%player%' then 'Player Prop'
        else ms.market_key end as market,
      e.start_time as "startTime",coalesce(e.home_team_id,'Home') as home,coalesce(e.away_team_id,'Away') as away,
      ms.american_odds as odds,ms.point::float as point,ms.bookmaker,ms.provider,
      coalesce(ms.raw_implied_probability,ms.implied_probability,0.5)::float as "rawImpliedProb",
      coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "noVigProb",
      coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "marketProb",
      coalesce((ms.raw->>'modelProb')::float,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float) as "modelProb",
      coalesce((ms.raw->>'confidence')::float,0.6) as confidence,
      greatest(0,extract(epoch from (now()-ms.pulled_at))/60)::float as "sourceAgeMin",
      coalesce(ms.source_timestamp,ms.pulled_at) as "sourceTimestamp",
      coalesce(ms.data_quality,1)::float as "dataQuality",
      case when extract(hour from e.start_time at time zone 'America/New_York')<12 then 'AM' else 'PM' end as period,
      coalesce(ms.raw->'sportFeatures','{}'::jsonb) as "sportFeatures",
      nullif(ms.raw->>'player','') as player,nullif(ms.raw->>'prop','') as prop,
      nullif(ms.raw->>'projectionMean','')::float as "projectionMean",
      nullif(ms.raw->>'projectionStdDev','')::float as "projectionStdDev",
      nullif(ms.raw->>'predictionProb','')::float as "predictionProb"
    from market_snapshots ms join events e on e.id=ms.event_id
    where e.start_time between now()-interval '2 hours' and now()+interval '8 days'
    order by ms.event_id,ms.bookmaker,ms.market_key,ms.selection_key,coalesce(ms.point,0),ms.pulled_at desc
    limit ${limit}
  `;
  return rows as unknown as Market[];
}

export async function lineHistory(eventId:string,marketKey:string,selectionKey:string,limit=100){
  const sql=db();if(!sql)return [];
  return sql`select american_odds as odds,pulled_at as "pulledAt",coalesce(no_vig_probability,implied_probability) as "impliedProbability" from market_snapshots where event_id=${eventId} and market_key=${marketKey} and selection_key=${selectionKey} order by pulled_at desc limit ${limit}`;
}

export async function recordModelRuns(rows:any[]){
  const sql=db();if(!sql)return 0;let n=0;
  for(const x of rows){
    await sql`
      insert into model_runs(
        event_id,market_key,selection_key,model_version,run_count,market_probability,model_probability,fair_american_odds,expected_value,
        full_kelly,fractional_kelly,agreement,confidence,grade,simulation_probability,simulation_ci_low,simulation_ci_high,simulation_mode,prediction_probability,feature_snapshot
      ) values(
        ${x.eventId||x.id},${x.marketKey||x.market},${x.selection},${process.env.MODEL_VERSION||'edgeforce-v30'},${x.simulationRuns},
        ${x.marketProb},${x.modelProb},${x.fairOdds},${x.expectedValue},${x.kelly},${x.quarterKelly},${x.agreement},${x.confidence},${x.grade},
        ${x.simProbability},${x.simCi?.[0]??null},${x.simCi?.[1]??null},${x.simulationMode||null},${x.predictionProb??null},
        ${sql.json({freshness:x.freshness,daysOut:x.daysOut,sportModelProbability:x.sportModelProbability,sportAdjustment:x.sportAdjustment,sportFactors:x.sportFactors,sportFeatures:x.sportFeatures||{},projectionMean:x.projectionMean,projectionStdDev:x.projectionStdDev,provider:x.provider,bookmaker:x.bookmaker,market:x.market,point:x.point,offeredOdds:x.odds,home:x.home,away:x.away,player:x.player,prop:x.prop})}
      )
    `;
    n++;
  }
  return n;
}
