import {db} from './db';
import type {Market} from './types';
import type {ContextChangeEvent} from './contextChanges';
import {contextMarketKey} from './contextChanges';
import {consensusMarketKey} from './marketConsensus';

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
      values(${m.id},${m.sourceProviderId||provider},${m.sourceBook||bookmaker},${m.market},${m.selection},${m.odds},${m.rawImpliedProb??m.marketProb},${m.marketProb},${Math.round(m.sourceAgeMin*60)},${sql.json(m as any)})
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
      ms.implied_probability::float as "rawImpliedProb",
      coalesce(ms.raw->>'sourceBook',ms.bookmaker) as "sourceBook",
      coalesce(ms.raw->>'sourceProviderId',ms.provider) as "sourceProviderId",
      ms.raw->>'marketRole' as "marketRole",
      coalesce((ms.raw->>'sourceProviderWeight')::float,1)::float as "sourceProviderWeight",
      ms.raw->'consensus' as consensus,
      coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "marketProb",
      coalesce((ms.raw->>'modelProb')::float,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float) as "modelProb",
      coalesce((ms.raw->>'confidence')::float,0.6) as confidence,
      greatest(0,extract(epoch from (now()-ms.pulled_at))/60)::float as "sourceAgeMin",
      case when extract(hour from e.start_time at time zone 'America/Chicago')<12 then 'AM' else 'PM' end as period,
      coalesce(ms.raw->'sportFeatures','{}'::jsonb) as "sportFeatures"
    from market_snapshots ms
    join events e on e.id=ms.event_id
    where e.start_time >= now() and e.start_time <= now()+interval '8 days'
    order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at desc
    limit ${limit}
  `;
  return rows as unknown as Market[];
}

export async function saveConsensusMarketSnapshots(markets:Market[],panelMarkets:Market[]){
  const sql=db();
  if(!sql||!markets.length)return {written:0,mode:'memory' as const};
  const panel=new Map<string,Market[]>();
  for(const quote of panelMarkets){
   const k=consensusMarketKey(quote);
   panel.set(k,[...(panel.get(k)||[]),quote]);
  }
  let written=0;
  for(const market of markets){
   const consensus=market.consensus;
   if(!consensus)continue;
   const quotes=(panel.get(consensusMarketKey(market))||[]).map(q=>({
    providerId:q.sourceProviderId||null,
    book:q.sourceBook||null,
    role:q.marketRole||'NEUTRAL',
    weight:q.sourceProviderWeight??1,
    odds:q.odds,
    probability:q.marketProb,
    rawImpliedProbability:q.rawImpliedProb??null,
    sourceAgeMin:q.sourceAgeMin
   }));
   await sql`
    insert into market_consensus_snapshots(
     event_id,market_key,selection_key,start_time,target_book,target_odds,target_book_found,
     consensus_probability,consensus_fair_odds,provider_count,book_count,dispersion,agreement,
     min_probability,max_probability,best_odds,best_book,sharp_probability,public_probability,
     sharp_public_gap,market_structure,outlier_books,books,quotes
    ) values(
     ${market.id},${market.market},${market.selection},${market.startTime},${consensus.targetBook},${market.odds},${consensus.targetBookFound},
     ${consensus.consensusProbability},${consensus.consensusFairOdds},${consensus.providerCount},${consensus.bookCount},
     ${consensus.dispersion},${consensus.agreement},${consensus.minProbability},${consensus.maxProbability},
     ${consensus.bestOdds},${consensus.bestBook??null},${consensus.sharpProbability??null},${consensus.publicProbability??null},
     ${consensus.sharpPublicGap??null},${consensus.marketStructure},${sql.json(consensus.outlierBooks)},${sql.json(consensus.books)},${sql.json(quotes)}
    )
   `;
   written++;
  }
  return {written,mode:'database' as const};
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
          sportFeatures:x.sportFeatures||{},
          contextSources:x.contextSources||[],
          contextQuality:x.contextQuality||null,
          simEngine:x.simEngine,
          rawSimProbability:x.rawSimProbability??x.simProbability,
          dynamicConfidence:x.dynamicConfidence??null,
          uncertainty:x.uncertainty??null,
          confidenceLabel:x.confidenceLabel??null,
          regime:x.regime??null,
          historicalShrinkage:x.historicalShrinkage??null,
          consensusBlend:x.consensusBlend??null,
          dynamicConfidenceComponents:x.dynamicConfidenceComponents??null,
          simProjection:x.simProjection||{},
          distributionFamily:x.simProjection?.distributionFamily||null,
          distributionConfidence:x.simProjection?.distributionConfidence??null,
          distributionQuantiles:{p10:x.simProjection?.p10??null,p50:x.simProjection?.p50??null,p90:x.simProjection?.p90??null},
          playerContext:x.playerContext||null,
          modelVotes:x.modelVotes||[],
          consensus:x.consensus||null,
          sourceBook:x.sourceBook||null,
          sourceProviderId:x.sourceProviderId||null,
          marketRole:x.marketRole||null
        })}
      )
    `;
    n++;
  }
  return n;
}


export async function recordContextChanges(changes:ContextChangeEvent[]){
 const sql=db();
 if(!sql||!changes.length)return 0;
 let written=0;
 for(const change of changes){
  await sql`
   insert into context_change_events(
    change_key,market_id,event_name,selection,sport,change_type,severity,reason,before_value,after_value,requires_resimulation,detected_at
   ) values(
    ${change.id},${change.marketId},${change.event},${change.selection},${change.sport},${change.type},${change.severity},${change.reason},
    ${sql.json((change.before??null) as any)},${sql.json((change.after??null) as any)},${change.requiresResimulation},${change.detectedAt}
   )
   on conflict (change_key) do update set
    severity=excluded.severity,
    reason=excluded.reason,
    before_value=excluded.before_value,
    after_value=excluded.after_value,
    detected_at=excluded.detected_at
  `;
  written++;
 }
 return written;
}


export async function loadContextMarketStates():Promise<Market[]>{
 const sql=db();
 if(!sql)return [];
 const rows=await sql`
  select snapshot
  from context_market_states
  order by updated_at desc
  limit 1000
 `;
 return rows.map((r:any)=>r.snapshot as Market);
}

export async function saveContextMarketStates(markets:Market[],revision:string){
 const sql=db();
 if(!sql||!markets.length)return 0;
 let written=0;
 for(const market of markets){
  const identity=contextMarketKey(market);
  await sql`
   insert into context_market_states(market_identity,market_id,snapshot,revision,updated_at)
   values(${identity},${market.id},${sql.json(market as any)},${revision},now())
   on conflict (market_identity) do update set
    market_id=excluded.market_id,
    snapshot=excluded.snapshot,
    revision=excluded.revision,
    updated_at=excluded.updated_at
  `;
  written++;
 }
 return written;
}
