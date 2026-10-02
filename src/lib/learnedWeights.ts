import {db} from './db';
import {rollingModelPerformance} from './modelPerformance';

export type LearnedWeightMap=Record<string,number>;

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const key=(modelName:string,sport:string,marketKey:string)=>[modelName,sport,marketKey].join('|');

export async function loadLearnedWeightMultipliers():Promise<LearnedWeightMap>{
 const sql=db();
 if(!sql)return {};
 try{
  const rows=await sql`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",model_name as "modelName",
    predicted_probability::float as predicted,offered_odds as odds,closing_odds as "closingOdds",outcome
   from historical_predictions
   where outcome is not null
   order by occurred_at desc
   limit 10000
  `;
  const perf=rollingModelPerformance(rows as any);
  const out:LearnedWeightMap={};
  const sportAgg=new Map<string,{sum:number;weight:number}>();
  const modelAgg=new Map<string,{sum:number;weight:number}>();

  for(const row of perf){
   if(row.sampleSize<25)continue;
   const clvTerm=clamp(row.avgClv,-.05,.05)*2;
   const multiplier=clamp(1+(row.decayedScore-.65)*1.4-row.calibrationError*1.6+clvTerm,.60,1.40);
   out[key(row.modelName,row.sport,row.marketKey)]=multiplier;

   const sk=key(row.modelName,row.sport,'*');
   const sa=sportAgg.get(sk)||{sum:0,weight:0};
   sa.sum+=multiplier*row.sampleSize; sa.weight+=row.sampleSize; sportAgg.set(sk,sa);

   const mk=key(row.modelName,'*','*');
   const ma=modelAgg.get(mk)||{sum:0,weight:0};
   ma.sum+=multiplier*row.sampleSize; ma.weight+=row.sampleSize; modelAgg.set(mk,ma);
  }

  for(const [k,v] of sportAgg)if(v.weight)out[k]=clamp(v.sum/v.weight,.65,1.35);
  for(const [k,v] of modelAgg)if(v.weight)out[k]=clamp(v.sum/v.weight,.70,1.30);
  return out;
 }catch{
  return {};
 }
}

export function learnedMultiplier(map:LearnedWeightMap|undefined,modelName:string,sport:string,marketKey:string){
 if(!map)return 1;
 return map[key(modelName,sport,marketKey)]??map[key(modelName,sport,'*')]??map[key(modelName,'*','*')]??1;
}
