import{t as e}from"./db-9LtqYd6N.js";import{r as t}from"./marketConsensus-Bw6TFEKX.js";var n=e=>{let t=Number(e);return Number.isFinite(t)?t:void 0},r=(e,t,r=0)=>{let i=n(e),a=n(t);return i===void 0&&a===void 0?!1:i===void 0||a===void 0?!0:Math.abs(a-i)>=r},i=(e,t)=>String(e??``).trim().toLowerCase()!==String(t??``).trim().toLowerCase(),a=e=>[e.id,e.market,e.selection].join(`|`),o=(e,t,n)=>`${a(e)}|${t}|${n}`;function s(e,t,n,r,i,a,s){let c=new Date().toISOString();e.push({id:o(t,n,c),marketId:t.id,event:t.event,selection:t.selection,sport:t.sport,type:n,severity:r,reason:i,before:a,after:s,detectedAt:c,requiresResimulation:!0})}function c(e,t){if(!e.length||!t.length)return[];let o=new Map(e.map(e=>[a(e),e])),c=[];for(let e of t){let t=o.get(a(e));if(!t)continue;let l=Math.abs((e.marketProb??0)-(t.marketProb??0));(e.odds!==t.odds||l>=.012)&&s(c,e,`LINE_MOVE`,l>=.03?`ACTION`:`WATCH`,`Market moved from ${t.odds} to ${e.odds}; implied probability delta ${(l*100).toFixed(1)} pts`,{odds:t.odds,marketProb:t.marketProb},{odds:e.odds,marketProb:e.marketProb});let u=t.sportFeatures||{},d=e.sportFeatures||{};for(let[t,n,i,a]of[[`injury`,`INJURY`,.08,`ACTION`],[`lineup`,`LINEUP`,.08,`ACTION`],[`starter`,`STARTER`,.08,`ACTION`],[`goalie`,`GOALIE`,.08,`ACTION`],[`quarterback`,`QUARTERBACK`,.08,`ACTION`],[`weather`,`WEATHER`,.15,`WATCH`]])r(u[t],d[t],i)&&s(c,e,n,a,`${t} context changed materially`,u[t],d[t]);let f=t.playerContext,p=e.playerContext;if(f||p){i(f?.status,p?.status)&&s(c,e,`PLAYER_STATUS`,`ACTION`,`Player status changed`,f?.status,p?.status),f?.starter!==p?.starter&&!(f?.starter===void 0&&p?.starter===void 0)&&s(c,e,`STARTER`,`ACTION`,`Player starting designation changed`,f?.starter,p?.starter),r(f?.availability,p?.availability,.05)&&s(c,e,`PLAYER_AVAILABILITY`,`ACTION`,`Player availability changed by at least 5 percentage points`,f?.availability,p?.availability);let t=n(f?.projection),a=n(p?.projection);if(t!==void 0||a!==void 0){let n=t===void 0||a===void 0?1/0:Math.abs(a-t),r=t&&a!==void 0?n/Math.max(.01,Math.abs(t)):1/0;(n>=.5||r>=.03)&&s(c,e,`PLAYER_PROJECTION`,r>=.08?`ACTION`:`WATCH`,`Player projection changed materially`,t,a)}}}return c}function l(e){let t=e.map(e=>({id:e.id,market:e.market,selection:e.selection,odds:e.odds,marketProb:e.marketProb,features:e.sportFeatures||{},player:e.playerContext||null})).sort((e,t)=>(e.id+e.market+e.selection).localeCompare(t.id+t.market+t.selection)),n=JSON.stringify(t),r=2166136261;for(let e=0;e<n.length;e++)r^=n.charCodeAt(e),r=Math.imul(r,16777619);return(r>>>0).toString(16).padStart(8,`0`)}async function u(t,n=`authorized-provider`,r=`DraftKings`){let i=e();if(!i)return{written:0,mode:`memory`};let a=0;for(let e of t)await i`
      insert into events(id,provider_event_id,sport,league,home_team_id,away_team_id,start_time,status)
      values(${e.id},${e.id},${e.sport},${e.league},${e.home},${e.away},${e.startTime},'scheduled')
      on conflict (id) do update set start_time=excluded.start_time,status='scheduled'
    `,await i`
      insert into market_snapshots(event_id,provider,bookmaker,market_key,selection_key,american_odds,implied_probability,no_vig_probability,source_age_seconds,raw)
      values(${e.id},${e.sourceProviderId||n},${e.sourceBook||r},${e.market},${e.selection},${e.odds},${e.rawImpliedProb??e.marketProb},${e.marketProb},${Math.round(e.sourceAgeMin*60)},${i.json(e)})
    `,a++;return{written:a,mode:`database`}}async function d(t=500){let n=e();return n?await n`
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
    limit ${t}
  `:[]}async function f(n,r){let i=e();if(!i||!n.length)return{written:0,mode:`memory`};let a=new Map;for(let e of r){let n=t(e);a.set(n,[...a.get(n)||[],e])}let o=0;for(let e of n){let n=e.consensus;if(!n)continue;let r=(a.get(t(e))||[]).map(e=>({providerId:e.sourceProviderId||null,book:e.sourceBook||null,role:e.marketRole||`NEUTRAL`,weight:e.sourceProviderWeight??1,odds:e.odds,probability:e.marketProb,rawImpliedProbability:e.rawImpliedProb??null,sourceAgeMin:e.sourceAgeMin}));await i`
    insert into market_consensus_snapshots(
     event_id,market_key,selection_key,start_time,target_book,target_odds,target_book_found,
     consensus_probability,consensus_fair_odds,provider_count,book_count,dispersion,agreement,
     min_probability,max_probability,best_odds,best_book,sharp_probability,public_probability,
     sharp_public_gap,market_structure,outlier_books,books,quotes
    ) values(
     ${e.id},${e.market},${e.selection},${e.startTime},${n.targetBook},${e.odds},${n.targetBookFound},
     ${n.consensusProbability},${n.consensusFairOdds},${n.providerCount},${n.bookCount},
     ${n.dispersion},${n.agreement},${n.minProbability},${n.maxProbability},
     ${n.bestOdds},${n.bestBook??null},${n.sharpProbability??null},${n.publicProbability??null},
     ${n.sharpPublicGap??null},${n.marketStructure},${i.json(n.outlierBooks)},${i.json(n.books)},${i.json(r)}
    )
   `,o++}return{written:o,mode:`database`}}async function p(t,n,r,i=100){let a=e();return a?a`
    select american_odds as odds,pulled_at as "pulledAt",implied_probability as "impliedProbability"
    from market_snapshots
    where event_id=${t} and market_key=${n} and selection_key=${r}
    order by pulled_at desc limit ${i}
  `:[]}async function m(t){let n=e();if(!n)return 0;let r=0;for(let e of t)await n`
      insert into model_runs(
        event_id,market_key,selection_key,model_version,run_count,
        market_probability,model_probability,fair_american_odds,expected_value,
        full_kelly,fractional_kelly,agreement,confidence,grade,
        simulation_probability,simulation_ci_low,simulation_ci_high,feature_snapshot
      ) values(
        ${e.id},${e.market},${e.selection},${process.env.MODEL_VERSION||`edgeforce-v8`},${e.simulationRuns},
        ${e.marketProb},${e.modelProb},${e.fairOdds},${e.expectedValue},
        ${e.kelly},${e.recommendedStake},${e.agreement},${e.confidence},${e.grade},
        ${e.simProbability},${e.simCi?.[0]??null},${e.simCi?.[1]??null},
        ${n.json({freshness:e.freshness,daysOut:e.daysOut,sportModelProbability:e.sportModelProbability,sportAdjustment:e.sportAdjustment,sportFactors:e.sportFactors,sportFeatures:e.sportFeatures||{},contextSources:e.contextSources||[],contextProvenance:e.contextProvenance||[],contextQuality:e.contextQuality||null,simEngine:e.simEngine,rawSimProbability:e.rawSimProbability??e.simProbability,dynamicConfidence:e.dynamicConfidence??null,uncertainty:e.uncertainty??null,confidenceLabel:e.confidenceLabel??null,regime:e.regime??null,historicalShrinkage:e.historicalShrinkage??null,consensusBlend:e.consensusBlend??null,optimizerBlend:e.optimizerBlend??null,reliabilityMode:e.reliabilityMode??null,reliabilityScore:e.reliabilityScore??null,reliabilityCriticalOpen:e.reliabilityCriticalOpen??null,dynamicConfidenceComponents:e.dynamicConfidenceComponents??null,simProjection:e.simProjection||{},distributionFamily:e.simProjection?.distributionFamily||null,distributionConfidence:e.simProjection?.distributionConfidence??null,distributionQuantiles:{p10:e.simProjection?.p10??null,p50:e.simProjection?.p50??null,p90:e.simProjection?.p90??null},playerContext:e.playerContext||null,modelVotes:e.modelVotes||[],consensus:e.consensus||null,sourceBook:e.sourceBook||null,sourceProviderId:e.sourceProviderId||null,marketRole:e.marketRole||null,offeredOdds:e.odds,marketKey:e.market,selectionKey:e.selection})}
      )
    `,r++;return r}async function h(t){let n=e();if(!n||!t.length)return 0;let r=0;for(let e of t)await n`
   insert into context_change_events(
    change_key,market_id,event_name,selection,sport,change_type,severity,reason,before_value,after_value,requires_resimulation,detected_at
   ) values(
    ${e.id},${e.marketId},${e.event},${e.selection},${e.sport},${e.type},${e.severity},${e.reason},
    ${n.json(e.before??null)},${n.json(e.after??null)},${e.requiresResimulation},${e.detectedAt}
   )
   on conflict (change_key) do update set
    severity=excluded.severity,
    reason=excluded.reason,
    before_value=excluded.before_value,
    after_value=excluded.after_value,
    detected_at=excluded.detected_at
  `,r++;return r}async function g(){let t=e();return t?(await t`
  select snapshot
  from context_market_states
  order by updated_at desc
  limit 1000
 `).map(e=>e.snapshot):[]}async function _(t,n){let r=e();if(!r||!t.length)return 0;let i=0;for(let e of t)await r`
   insert into context_market_states(market_identity,market_id,snapshot,revision,updated_at)
   values(${a(e)},${e.id},${r.json(e)},${n},now())
   on conflict (market_identity) do update set
    market_id=excluded.market_id,
    snapshot=excluded.snapshot,
    revision=excluded.revision,
    updated_at=excluded.updated_at
  `,i++;return i}export{m as a,u as c,h as i,l,p as n,f as o,g as r,_ as s,d as t,c as u};