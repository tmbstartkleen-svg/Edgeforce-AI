import {db} from './db';
import type {PredictionContract} from './predictionMarkets';
import type {PredictionTrade} from './predictionFlow';
import type {PredictionDecisionSignal} from './predictionDecisionSignals';
import {classifyPredictionContract} from './predictionCategories';

function hourBucket(date=new Date()){
 const d=new Date(date);
 d.setUTCMinutes(0,0,0);
 return d.toISOString();
}

export async function persistPredictionContracts(contracts:PredictionContract[],snapshot=true){
 const sql=db();
 if(!sql||!contracts.length)return {stateWritten:0,snapshotsWritten:0,mode:'memory' as const};

 const maxContracts=Math.max(100,Math.min(5000,Number(process.env.PREDICTION_PERSIST_MAX_CONTRACTS||2000)));
 const selected=[...contracts]
  .sort((a,b)=>((b.volume??0)+(b.liquidity??0))-((a.volume??0)+(a.liquidity??0)))
  .slice(0,maxContracts);

 let stateWritten=0;
 let snapshotsWritten=0;
 const observedHour=hourBucket();

 for(const contract of selected){
  const venue=String(contract.source||'Unknown');
  const category=classifyPredictionContract(contract);
  await sql`
   insert into prediction_market_state(
    venue,contract_id,title,category,yes_probability,bid_probability,ask_probability,
    volume,liquidity,expires_at,raw,updated_at
   ) values(
    ${venue},${contract.id},${contract.title},${category},${contract.yesProbability},
    ${contract.bidProbability??null},${contract.askProbability??null},
    ${contract.volume??null},${contract.liquidity??null},${contract.expiresAt??null},
    ${sql.json(contract as any)},now()
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
  `;
  stateWritten++;

  if(snapshot){
   const inserted=await sql`
    insert into prediction_market_snapshots(
     venue,contract_id,title,category,yes_probability,bid_probability,ask_probability,
     volume,liquidity,observed_hour,raw
    ) values(
     ${venue},${contract.id},${contract.title},${category},${contract.yesProbability},
     ${contract.bidProbability??null},${contract.askProbability??null},
     ${contract.volume??null},${contract.liquidity??null},${observedHour},
     ${sql.json(contract as any)}
    )
    on conflict (venue,contract_id,observed_hour) do nothing
    returning id
   `;
   snapshotsWritten+=inserted.length;
  }
 }

 return {stateWritten,snapshotsWritten,mode:'database' as const};
}

export async function persistPredictionTrades(trades:PredictionTrade[]){
 const sql=db();
 if(!sql||!trades.length)return {written:0,tradersUpdated:0,mode:'memory' as const};

 const maxTrades=Math.max(100,Math.min(5000,Number(process.env.PREDICTION_PERSIST_MAX_TRADES||1500)));
 const selected=[...trades]
  .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())
  .slice(0,maxTrades);

 let written=0;
 const touchedTraders=new Set<string>();

 for(const trade of selected){
  const inserted=await sql`
   insert into prediction_trade_tape(
    venue,trade_id,market_id,title,trader_id,direction,price,size,notional,
    signed_yes_flow,traded_at,raw
   ) values(
    ${trade.venue},${trade.id},${trade.marketId},${trade.title},${trade.traderId??null},
    ${trade.direction},${trade.price},${trade.size},${trade.notional},
    ${trade.signedYesFlow},${trade.timestamp},${sql.json(trade as any)}
   )
   on conflict (venue,trade_id) do nothing
   returning trade_id
  `;
  if(!inserted.length)continue;
  written++;

  if(trade.traderId){
   const key=`${trade.venue}|${trade.traderId}`;
   touchedTraders.add(key);
   await sql`
    insert into prediction_trader_profiles(
     venue,trader_id,trades_observed,notional_observed,avg_trade_notional,max_trade_notional,
     net_yes_flow,first_seen_at,last_seen_at,updated_at
    ) values(
     ${trade.venue},${trade.traderId},1,${trade.notional},${trade.notional},${trade.notional},
     ${trade.signedYesFlow},${trade.timestamp},${trade.timestamp},now()
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
   `;
  }
 }

 return {written,tradersUpdated:touchedTraders.size,mode:'database' as const};
}


export async function persistPredictionDecisionSignals(signals:PredictionDecisionSignal[]){
 const sql=db();
 if(!sql||!signals.length)return {written:0,mode:'memory' as const};
 const observedHour=hourBucket();
 let written=0;
 for(const signal of signals){
  const inserted=await sql`
   insert into prediction_signal_snapshots(
    observed_hour,signal_key,venue,contract_id,source_venue,source_contract_id,title,category,
    direction,action,score,evidence_grade,match_quality,similarity,fair_yes_probability,
    fair_outcome_probability,market_yes_probability,execution_probability,outcome_edge,
    entry_probability,take_profit_probability,review_fair_probability,spread_probability,
    volume,liquidity,flow_support,momentum_support,smart_trader_support,risk_flags,reasons,metadata
   ) values(
    ${observedHour},${signal.signalKey},${signal.venue},${signal.contractId},
    ${signal.sourceVenue},${signal.sourceContractId},${signal.title},${signal.category},
    ${signal.direction},${signal.action},${signal.score},${signal.evidenceGrade},
    ${signal.matchQuality},${signal.similarity},${signal.fairYesProbability},
    ${signal.fairOutcomeProbability},${signal.marketYesProbability},${signal.executionProbability},
    ${signal.edge},${signal.entryProbability},${signal.takeProfitProbability},
    ${signal.reviewFairProbability},${signal.spreadProbability??null},${signal.volume??null},
    ${signal.liquidity??null},${signal.flowSupport},${signal.momentumSupport},
    ${signal.smartTraderSupport},${sql.json(signal.riskFlags)},${sql.json(signal.reasons)},
    ${sql.json({score:signal.score,evidenceGrade:signal.evidenceGrade} as any)}
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
  `;
  written+=inserted.length;
 }
 return {written,mode:'database' as const};
}

export type PublicTraderProfileInput={
 venue:string;
 traderId:string;
 rank?:number;
 pnl?:number;
 volume?:number;
 marketCount?:number;
 biggestWin?:number;
 name?:string;
 verified?:boolean;
 raw?:Record<string,unknown>;
};

export async function upsertPublicTraderProfiles(rows:PublicTraderProfileInput[]){
 const sql=db();
 if(!sql||!rows.length)return {written:0,mode:'memory' as const};
 let written=0;
 for(const row of rows){
  await sql`
   insert into prediction_trader_profiles(
    venue,trader_id,public_rank,public_pnl,public_volume,public_market_count,
    public_biggest_win,public_name,verified,raw,updated_at
   ) values(
    ${row.venue},${row.traderId},${row.rank??null},${row.pnl??null},${row.volume??null},
    ${row.marketCount??null},${row.biggestWin??null},${row.name??null},${row.verified??null},
    ${sql.json((row.raw||{}) as any)},now()
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
  `;
  written++;
 }
 return {written,mode:'database' as const};
}

export async function predictionWarehouseStats(){
 const sql=db();
 if(!sql)return {
  configured:false,markets:0,snapshots:0,trades:0,traders:0,signals:0,buySignals:0,lastMarketUpdate:null,lastTrade:null,lastSignal:null
 };
 const [markets,snapshots,trades,traders,signals]=await Promise.all([
  sql`select count(*)::int as count,max(updated_at) as latest from prediction_market_state`,
  sql`select count(*)::int as count,max(observed_hour) as latest from prediction_market_snapshots`,
  sql`select count(*)::int as count,max(traded_at) as latest from prediction_trade_tape`,
  sql`select count(*)::int as count,max(updated_at) as latest from prediction_trader_profiles`,
  sql`select count(*)::int as count,
      count(*) filter (where action in ('BUY_YES','BUY_NO'))::int as buys,
      max(observed_hour) as latest
    from prediction_signal_snapshots`
 ]);
 return {
  configured:true,
  markets:Number(markets[0]?.count||0),
  snapshots:Number(snapshots[0]?.count||0),
  trades:Number(trades[0]?.count||0),
  traders:Number(traders[0]?.count||0),
  signals:Number(signals[0]?.count||0),
  buySignals:Number(signals[0]?.buys||0),
  lastMarketUpdate:markets[0]?.latest??null,
  lastSnapshot:snapshots[0]?.latest??null,
  lastTrade:trades[0]?.latest??null,
  lastTraderUpdate:traders[0]?.latest??null,
  lastSignal:signals[0]?.latest??null
 };
}

export async function loadPredictionPriceHistory(venue:string,contractId:string,limit=168){
 const sql=db();
 if(!sql)return [];
 return sql`
  select yes_probability::float as probability,bid_probability::float as "bidProbability",
   ask_probability::float as "askProbability",volume::float,liquidity::float,
   observed_hour as "observedAt"
  from prediction_market_snapshots
  where lower(venue)=lower(${venue}) and contract_id=${contractId}
  order by observed_hour desc
  limit ${Math.max(1,Math.min(1000,limit))}
 `;
}
