import {db} from './db';
import type {PredictionContract} from './predictionMarkets';
import {classifyPredictionContract} from './predictionCategories';

const probability=(value:unknown):value is number=>
 typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;

/** Preserve the provider's values; never invent a missing No quote. */
function validateContract(contract:PredictionContract){
 if(!contract||![contract.id,contract.title,contract.source].every(value=>typeof value==='string'&&value.trim())){
  throw new Error('Prediction contract identity is incomplete');
 }
 if(!probability(contract.yesProbability)||!probability(contract.noProbability)){
  throw new Error('Prediction contract requires finite Yes and No probabilities in [0,1]');
 }
}

export async function persistPredictionContractBatch(contracts:PredictionContract[],snapshot=true){
 const sql=db();
 if(!sql||!contracts.length)return {stateWritten:0,snapshotsWritten:0,mode:'memory' as const};
 const configuredLimit=Number(process.env.PREDICTION_PERSIST_MAX_CONTRACTS||2000);
 const maxContracts=Number.isFinite(configuredLimit)?Math.max(100,Math.min(5000,Math.floor(configuredLimit))):2000;
 const selected=[...contracts]
  .sort((a,b)=>((b.volume??0)+(b.liquidity??0))-((a.volume??0)+(a.liquidity??0)))
  .slice(0,maxContracts);
 // Reject an invalid batch before writing any state or snapshot rows.
 selected.forEach(validateContract);

 // Older databases have additional NOT NULL columns that newer schemas omit.
 // Discover only these fixed, known columns once per batch, never globally:
 // separate deployments may use different databases. No runtime DDL is needed.
 const legacyColumns=snapshot?await sql`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='prediction_market_snapshots'
   and column_name in ('provider','no_probability')
 `:[];
 const hasProvider=legacyColumns.some(row=>row.column_name==='provider');
 const hasNoProbability=legacyColumns.some(row=>row.column_name==='no_probability');
 const observed=new Date();
 observed.setUTCMinutes(0,0,0);
 const observedHour=observed.toISOString();
 let stateWritten=0;
 let snapshotsWritten=0;

 for(const contract of selected){
  const venue=contract.source;
  const category=classifyPredictionContract(contract);
  // A failed snapshot must not leave an apparently successful state update.
  // Bound the transaction to one contract instead of locking the entire batch.
  const insertedCount=await sql.begin(async tx=>{
   await tx`
    insert into public.prediction_market_state(
     venue,contract_id,title,category,yes_probability,bid_probability,ask_probability,
     volume,liquidity,expires_at,raw,updated_at
    ) values(
     ${venue},${contract.id},${contract.title},${category},${contract.yesProbability},
     ${contract.bidProbability??null},${contract.askProbability??null},
     ${contract.volume??null},${contract.liquidity??null},${contract.expiresAt??null},
     ${tx.json(contract as any)},now()
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
   if(!snapshot)return 0;
   const row={
    venue,contract_id:contract.id,title:contract.title,category,
    yes_probability:contract.yesProbability,
    bid_probability:contract.bidProbability??null,ask_probability:contract.askProbability??null,
    volume:contract.volume??null,liquidity:contract.liquidity??null,
    observed_hour:observedHour,raw:tx.json(contract as any),
    ...(hasProvider?{provider:venue}:{}),
    ...(hasNoProbability?{no_probability:contract.noProbability}:{}),
   };
   const inserted=await tx`
    insert into public.prediction_market_snapshots ${tx(row)}
    on conflict (venue,contract_id,observed_hour) do nothing
    returning id
   `;
   return inserted.length;
  });
  stateWritten++;
  snapshotsWritten+=Number(insertedCount);
 }
 return {stateWritten,snapshotsWritten,mode:'database' as const};
}
