import {fetchWithFailover} from './providers/failover';

export type PredictionContract={
  id:string;
  title:string;
  category:string;
  yesProbability:number;
  noProbability:number;
  modelProbability:number;
  probabilityDifference:number;
  volume?:number;
  expiresAt?:string;
  source:string;
};

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
const num=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const probability=(v:unknown,fallback=.5)=>{
  const n=num(v,fallback);
  if(n>1&&n<=100)return n/100;
  return Math.max(.001,Math.min(.999,n));
};

function rows(payload:unknown):unknown[]{
  if(Array.isArray(payload))return payload;
  const root=obj(payload);
  for(const key of ['markets','contracts','results','data']){
    const value=root[key];
    if(Array.isArray(value))return value;
  }
  return [];
}

export function normalizePredictionMarkets(payload:unknown,source='prediction-provider'):PredictionContract[]{
  return rows(payload).map((value,index)=>{
    const row=obj(value);
    const yes=probability(row.yesProbability ?? row.yes_probability ?? row.yesPrice ?? row.yes_price ?? row.probability,.5);
    const model=probability(row.modelProbability ?? row.model_probability,yes);
    return {
      id:str(row.id,source+'-'+index),
      title:str(row.title,str(row.question,str(row.name,'Contract '+(index+1)))),
      category:str(row.category,str(row.group,'Prediction Market')),
      yesProbability:yes,
      noProbability:1-yes,
      modelProbability:model,
      probabilityDifference:model-yes,
      volume:num(row.volume,num(row.liquidity,0))||undefined,
      expiresAt:str(row.expiresAt,str(row.expires_at,str(row.closeTime,str(row.close_time,''))))||undefined,
      source
    };
  });
}

export async function fetchPredictionMarkets(){
  const result=await fetchWithFailover('PREDICTION_MARKETS');
  if(!result.ok){
    return {mode:result.attempts.length?'failed':'unconfigured',source:null,contracts:[] as PredictionContract[],attempts:result.attempts,error:result.error};
  }
  const source=result.providerName||result.providerId||'prediction-provider';
  return {mode:'live',source,contracts:normalizePredictionMarkets(result.data,source),attempts:result.attempts};
}
