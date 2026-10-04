import {fetchWithFailover} from './providers/failover';
import {fetchPublicKalshi} from './providers/kalshi';
import {fetchPublicPolymarket} from './providers/polymarket';

export type PredictionVenueType='PREDICTION_PROVIDER'|'PREDICTION_EXCHANGE';

export type PredictionContract={
  id:string;
  title:string;
  category:string;
  yesProbability:number;
  noProbability:number;
  modelProbability:number;
  probabilityDifference:number;
  volume?:number;
  liquidity?:number;
  bidProbability?:number;
  askProbability?:number;
  expiresAt?:string;
  source:string;
  venueType?:PredictionVenueType;
};

export type PredictionSourceStatus={
 source:string;
 ok:boolean;
 count:number;
 error?:string;
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
    const bidRaw=num(row.bidProbability ?? row.bid_probability ?? row.bid,Number.NaN);
    const askRaw=num(row.askProbability ?? row.ask_probability ?? row.ask,Number.NaN);
    const volume=num(row.volume,0);
    const liquidity=num(row.liquidity,0);
    return {
      id:str(row.id,source+'-'+index),
      title:str(row.title,str(row.question,str(row.name,'Contract '+(index+1)))),
      category:str(row.category,str(row.group,'Prediction Market')),
      yesProbability:yes,
      noProbability:1-yes,
      modelProbability:model,
      probabilityDifference:model-yes,
      volume:volume>0?volume:undefined,
      liquidity:liquidity>0?liquidity:undefined,
      bidProbability:Number.isFinite(bidRaw)?probability(bidRaw,yes):undefined,
      askProbability:Number.isFinite(askRaw)?probability(askRaw,yes):undefined,
      expiresAt:str(row.expiresAt,str(row.expires_at,str(row.closeTime,str(row.close_time,''))))||undefined,
      source,
      venueType:'PREDICTION_PROVIDER'
    };
  });
}

function dedupeContracts(rows:PredictionContract[]){
 const map=new Map<string,PredictionContract>();
 for(const row of rows){
  const key=[row.source,row.id].join('|').toLowerCase();
  const prior=map.get(key);
  if(!prior){
   map.set(key,row);
   continue;
  }
  const priorDepth=(prior.volume??0)+(prior.liquidity??0);
  const nextDepth=(row.volume??0)+(row.liquidity??0);
  if(nextDepth>priorDepth)map.set(key,row);
 }
 return [...map.values()];
}

export async function fetchPredictionMarkets(){
  const [configured,kalshi,polymarket]=await Promise.all([
    fetchWithFailover('PREDICTION_MARKETS'),
    fetchPublicKalshi(),
    fetchPublicPolymarket()
  ]);

  const configuredSource=configured.providerName||configured.providerId||'prediction-provider';
  const configuredContracts=configured.ok
   ?normalizePredictionMarkets(configured.data,configuredSource)
   :[];

  const contracts=dedupeContracts([
   ...configuredContracts,
   ...(kalshi.ok?kalshi.contracts:[]),
   ...(polymarket.ok?polymarket.contracts:[])
  ]);

  const maxContracts=Math.max(100,Math.min(10000,Number(process.env.PREDICTION_MARKET_MAX_CONTRACTS||4000)));
  const ranked=[...contracts]
   .sort((a,b)=>((b.volume??0)+(b.liquidity??0))-((a.volume??0)+(a.liquidity??0)))
   .slice(0,maxContracts);

  const sources:PredictionSourceStatus[]=[
   {
    source:configuredSource,
    ok:configured.ok,
    count:configuredContracts.length,
    error:configured.ok?undefined:configured.error
   },
   {
    source:'Kalshi',
    ok:kalshi.ok,
    count:kalshi.contracts.length,
    error:kalshi.ok?undefined:kalshi.error
   },
   {
    source:'Polymarket',
    ok:polymarket.ok,
    count:polymarket.contracts.length,
    error:polymarket.ok?undefined:polymarket.error
   }
  ];

  const liveSources=sources.filter(x=>x.ok&&x.count>0).map(x=>x.source);
  const warnings=sources
   .filter(x=>!x.ok)
   .map(x=>`${x.source}: ${x.error||'feed unavailable'}`);

  return {
   mode:ranked.length?'live':configured.attempts.length?'failed':'unconfigured',
   source:liveSources.join(' + ')||null,
   contracts:ranked,
   attempts:configured.attempts,
   sources,
   warnings,
   error:ranked.length?undefined:(configured.error||kalshi.error||polymarket.error||'No prediction-market contracts available')
  };
}
