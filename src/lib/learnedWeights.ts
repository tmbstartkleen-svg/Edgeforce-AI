import {db} from './db';
import {rollingModelPerformance} from './modelPerformance';
import {loadGovernanceMultipliers,modelGovernanceKey} from './modelGovernance';

export type LearnedWeightMap=Record<string,number>;

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const key=(modelName:string,sport:string,marketKey:string)=>[modelName,sport,marketKey].join('|');

function aggregates(exact:Array<{modelName:string;sport:string;marketKey:string;multiplier:number;sampleSize:number}>){
 const out:LearnedWeightMap={};
 const sportAgg=new Map<string,{sum:number;weight:number}>();
 const modelAgg=new Map<string,{sum:number;weight:number}>();
 for(const row of exact){
  out[key(row.modelName,row.sport,row.marketKey)]=row.multiplier;
  const sk=key(row.modelName,row.sport,'*');
  const sa=sportAgg.get(sk)||{sum:0,weight:0};
  sa.sum+=row.multiplier*row.sampleSize; sa.weight+=row.sampleSize; sportAgg.set(sk,sa);
  const mk=key(row.modelName,'*','*');
  const ma=modelAgg.get(mk)||{sum:0,weight:0};
  ma.sum+=row.multiplier*row.sampleSize; ma.weight+=row.sampleSize; modelAgg.set(mk,ma);
 }
 for(const [k,v] of sportAgg)if(v.weight)out[k]=clamp(v.sum/v.weight,.75,1.25);
 for(const [k,v] of modelAgg)if(v.weight)out[k]=clamp(v.sum/v.weight,.80,1.20);
 return out;
}

export async function loadLearnedWeightMultipliers():Promise<LearnedWeightMap>{
 const sql=db();
 if(!sql)return {};
 try{
  const governance=await loadGovernanceMultipliers().catch(()=>({}));
  const snapshots=await sql`
   select distinct on (model_name,sport,market_key)
    model_name as "modelName",sport,market_key as "marketKey",
    multiplier::float,sample_size as "sampleSize"
   from learned_model_weight_snapshots
   where promoted=true
   order by model_name,sport,market_key,as_of desc
  `;
  if(snapshots.length){
   return aggregates((snapshots as any[]).map(row=>({
    modelName:String(row.modelName),
    sport:String(row.sport),
    marketKey:String(row.marketKey),
    multiplier:clamp((Number(row.multiplier)||1)*(governance[modelGovernanceKey(String(row.modelName),String(row.sport),String(row.marketKey))]??1),.35,1.25),
    sampleSize:Math.max(1,Number(row.sampleSize)||1)
   })));
  }

  // Backward-compatible bootstrap until the first V29 recalibration run is promoted.
  const rows=await sql`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit 10000
  `;
  const perf=rollingModelPerformance(rows as any);
  return aggregates(perf.filter(row=>row.sampleSize>=25).map(row=>{
   const clvTerm=clamp(row.avgClv,-.05,.05)*2;
   const learned=clamp(1+(row.decayedScore-.65)*1.4-row.calibrationError*1.6+clvTerm,.75,1.25);
   const governanceMultiplier=governance[modelGovernanceKey(row.modelName,row.sport,row.marketKey)]??1;
   const multiplier=clamp(learned*governanceMultiplier,.35,1.25);
   return {modelName:row.modelName,sport:row.sport,marketKey:row.marketKey,multiplier,sampleSize:row.sampleSize};
  }));
 }catch{
  return {};
 }
}

export function learnedMultiplier(map:LearnedWeightMap|undefined,modelName:string,sport:string,marketKey:string){
 if(!map)return 1;
 return map[key(modelName,sport,marketKey)]??map[key(modelName,sport,'*')]??map[key(modelName,'*','*')]??1;
}
