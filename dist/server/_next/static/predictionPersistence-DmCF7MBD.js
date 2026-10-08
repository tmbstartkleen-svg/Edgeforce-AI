import{t as e}from"./db-9LtqYd6N.js";import{t}from"./predictionCategories-Du0ipw4P.js";var n=e=>typeof e==`number`&&Number.isFinite(e)&&e>=0&&e<=1;function r(e){if(!e||![e.id,e.title,e.source].every(e=>typeof e==`string`&&e.trim()))throw Error(`Prediction contract identity is incomplete`);if(!n(e.yesProbability)||!n(e.noProbability))throw Error(`Prediction contract requires finite Yes and No probabilities in [0,1]`)}async function i(n,i=!0){let a=e();if(!a||!n.length)return{stateWritten:0,snapshotsWritten:0,mode:`memory`};let o=Number(process.env.PREDICTION_PERSIST_MAX_CONTRACTS||2e3),s=Number.isFinite(o)?Math.max(100,Math.min(5e3,Math.floor(o))):2e3,c=[...n].sort((e,t)=>(t.volume??0)+(t.liquidity??0)-((e.volume??0)+(e.liquidity??0))).slice(0,s);c.forEach(r);let l=i?await a`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='prediction_market_snapshots'
   and column_name in ('provider','no_probability')
 `:[],u=l.some(e=>e.column_name===`provider`),d=l.some(e=>e.column_name===`no_probability`),f=new Date;f.setUTCMinutes(0,0,0);let p=f.toISOString(),m=0,h=0;for(let e of c){let n=e.source,r=t(e),o=await a.begin(async t=>(await t`
    insert into public.prediction_market_state(
     venue,contract_id,title,category,yes_probability,bid_probability,ask_probability,
     volume,liquidity,expires_at,raw,updated_at
    ) values(
     ${n},${e.id},${e.title},${r},${e.yesProbability},
     ${e.bidProbability??null},${e.askProbability??null},
     ${e.volume??null},${e.liquidity??null},${e.expiresAt??null},
     ${t.json(e)},now()
    )
    on conflict (venue,contract_id) do update set
     title=excluded.title,
     category=excluded.category,
     yes_probability=excluded.yes_probability,
     bid_probability=excluded.bid_probability,
     ask_probability=excluded.ask_probability,
     volume=excluded.volume,
     liquidity=excluded.liquidity,
     expires_at=excluded.expires_at,
     raw=excluded.raw,
     updated_at=now()
   `,i?(await t`
    insert into public.prediction_market_snapshots ${t({venue:n,contract_id:e.id,title:e.title,category:r,yes_probability:e.yesProbability,bid_probability:e.bidProbability??null,ask_probability:e.askProbability??null,volume:e.volume??null,liquidity:e.liquidity??null,observed_hour:p,raw:t.json(e),...u?{provider:n}:{},...d?{no_probability:e.noProbability}:{}})}
    on conflict (venue,contract_id,observed_hour) do nothing
    returning id
   `).length:0));m++,h+=Number(o)}return{stateWritten:m,snapshotsWritten:h,mode:`database`}}function a(e=new Date){let t=new Date(e);return t.setUTCMinutes(0,0,0),t.toISOString()}async function o(e,t=!0){return i(e,t)}async function s(t){let n=e();if(!n||!t.length)return{written:0,tradersUpdated:0,mode:`memory`};let r=Math.max(100,Math.min(5e3,Number(process.env.PREDICTION_PERSIST_MAX_TRADES||1500))),i=[...t].sort((e,t)=>new Date(t.timestamp).getTime()-new Date(e.timestamp).getTime()).slice(0,r),a=0,o=new Set;for(let e of i)if((await n`
   insert into prediction_trade_tape(
    venue,trade_id,market_id,title,trader_id,direction,price,size,notional,
    signed_yes_flow,traded_at,raw
   ) values(
    ${e.venue},${e.id},${e.marketId},${e.title},${e.traderId??null},
    ${e.direction},${e.price},${e.size},${e.notional},
    ${e.signedYesFlow},${e.timestamp},${n.json(e)}
   )
   on conflict (venue,trade_id) do nothing
   returning trade_id
  `).length&&(a++,e.traderId)){let t=`${e.venue}|${e.traderId}`;o.add(t),await n`
    insert into prediction_trader_profiles(
     venue,trader_id,trades_observed,notional_observed,avg_trade_notional,max_trade_notional,
     net_yes_flow,first_seen_at,last_seen_at,updated_at
    ) values(
     ${e.venue},${e.traderId},1,${e.notional},${e.notional},${e.notional},
     ${e.signedYesFlow},${e.timestamp},${e.timestamp},now()
    )
    on conflict (venue,trader_id) do update set
     trades_observed=prediction_trader_profiles.trades_observed+1,
     notional_observed=prediction_trader_profiles.notional_observed+excluded.notional_observed,
     avg_trade_notional=(prediction_trader_profiles.notional_observed+excluded.notional_observed)
      /greatest(1,prediction_trader_profiles.trades_observed+1),
     max_trade_notional=greatest(prediction_trader_profiles.max_trade_notional,excluded.max_trade_notional),
     net_yes_flow=prediction_trader_profiles.net_yes_flow+excluded.net_yes_flow,
     first_seen_at=least(prediction_trader_profiles.first_seen_at,excluded.first_seen_at),
     last_seen_at=greatest(prediction_trader_profiles.last_seen_at,excluded.last_seen_at),
     updated_at=now()
   `}return{written:a,tradersUpdated:o.size,mode:`database`}}async function c(t){let n=e();if(!n||!t.length)return{written:0,mode:`memory`};let r=a(),i=0;for(let e of t){let t=await n`
   insert into prediction_signal_snapshots(
    observed_hour,signal_key,venue,contract_id,source_venue,source_contract_id,title,category,
    direction,action,score,evidence_grade,match_quality,similarity,fair_yes_probability,
    fair_outcome_probability,market_yes_probability,execution_probability,outcome_edge,
    entry_probability,take_profit_probability,review_fair_probability,spread_probability,
    volume,liquidity,flow_support,momentum_support,smart_trader_support,risk_flags,reasons,metadata
   ) values(
    ${r},${e.signalKey},${e.venue},${e.contractId},
    ${e.sourceVenue},${e.sourceContractId},${e.title},${e.category},
    ${e.direction},${e.action},${e.score},${e.evidenceGrade},
    ${e.matchQuality},${e.similarity},${e.fairYesProbability},
    ${e.fairOutcomeProbability},${e.marketYesProbability},${e.executionProbability},
    ${e.edge},${e.entryProbability},${e.takeProfitProbability},
    ${e.reviewFairProbability},${e.spreadProbability??null},${e.volume??null},
    ${e.liquidity??null},${e.flowSupport},${e.momentumSupport},
    ${e.smartTraderSupport},${n.json(e.riskFlags)},${n.json(e.reasons)},
    ${n.json({score:e.score,evidenceGrade:e.evidenceGrade})}
   )
   on conflict (signal_key,observed_hour) do update set
    action=excluded.action,
    score=excluded.score,
    evidence_grade=excluded.evidence_grade,
    fair_yes_probability=excluded.fair_yes_probability,
    fair_outcome_probability=excluded.fair_outcome_probability,
    market_yes_probability=excluded.market_yes_probability,
    execution_probability=excluded.execution_probability,
    outcome_edge=excluded.outcome_edge,
    entry_probability=excluded.entry_probability,
    take_profit_probability=excluded.take_profit_probability,
    review_fair_probability=excluded.review_fair_probability,
    spread_probability=excluded.spread_probability,
    volume=excluded.volume,
    liquidity=excluded.liquidity,
    flow_support=excluded.flow_support,
    momentum_support=excluded.momentum_support,
    smart_trader_support=excluded.smart_trader_support,
    risk_flags=excluded.risk_flags,
    reasons=excluded.reasons,
    metadata=excluded.metadata
   returning id
  `;i+=t.length}return{written:i,mode:`database`}}async function l(t){let n=e();if(!n||!t.length)return{written:0,mode:`memory`};let r=0;for(let e of t)await n`
   insert into prediction_trader_profiles(
    venue,trader_id,public_rank,public_pnl,public_volume,public_market_count,
    public_biggest_win,public_name,verified,raw,updated_at
   ) values(
    ${e.venue},${e.traderId},${e.rank??null},${e.pnl??null},${e.volume??null},
    ${e.marketCount??null},${e.biggestWin??null},${e.name??null},${e.verified??null},
    ${n.json(e.raw||{})},now()
   )
   on conflict (venue,trader_id) do update set
    public_rank=coalesce(excluded.public_rank,prediction_trader_profiles.public_rank),
    public_pnl=coalesce(excluded.public_pnl,prediction_trader_profiles.public_pnl),
    public_volume=coalesce(excluded.public_volume,prediction_trader_profiles.public_volume),
    public_market_count=coalesce(excluded.public_market_count,prediction_trader_profiles.public_market_count),
    public_biggest_win=coalesce(excluded.public_biggest_win,prediction_trader_profiles.public_biggest_win),
    public_name=coalesce(excluded.public_name,prediction_trader_profiles.public_name),
    verified=coalesce(excluded.verified,prediction_trader_profiles.verified),
    raw=case when excluded.raw='{}'::jsonb then prediction_trader_profiles.raw else excluded.raw end,
    updated_at=now()
  `,r++;return{written:r,mode:`database`}}async function u(){let t=e();if(!t)return{configured:!1,markets:0,snapshots:0,trades:0,traders:0,signals:0,buySignals:0,lastMarketUpdate:null,lastTrade:null,lastSignal:null};let[n,r,i,a,o]=await Promise.all([t`select count(*)::int as count,max(updated_at) as latest from prediction_market_state`,t`select count(*)::int as count,max(observed_hour) as latest from prediction_market_snapshots`,t`select count(*)::int as count,max(traded_at) as latest from prediction_trade_tape`,t`select count(*)::int as count,max(updated_at) as latest from prediction_trader_profiles`,t`select count(*)::int as count,
      count(*) filter (where action in ('BUY_YES','BUY_NO'))::int as buys,
      max(observed_hour) as latest
    from prediction_signal_snapshots`]);return{configured:!0,markets:Number(n[0]?.count||0),snapshots:Number(r[0]?.count||0),trades:Number(i[0]?.count||0),traders:Number(a[0]?.count||0),signals:Number(o[0]?.count||0),buySignals:Number(o[0]?.buys||0),lastMarketUpdate:n[0]?.latest??null,lastSnapshot:r[0]?.latest??null,lastTrade:i[0]?.latest??null,lastTraderUpdate:a[0]?.latest??null,lastSignal:o[0]?.latest??null}}export{l as a,u as i,c as n,s as r,o as t};