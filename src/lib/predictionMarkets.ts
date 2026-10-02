import {fetchWithFailover} from './providers/failover';
import {impliedProbability} from './math';

export type PredictionContract={
  id:string;
  eventId?:string;
  title:string;
  category:string;
  market?:string;
  selection?:string;
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
const probability=(v:unknown,fallback=.5)=>{const n=num(v,fallback);if(n>1&&n<=100)return n/100;return Math.max(.001,Math.min(.999,n))};

function rows(payload:unknown):unknown[]{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const key of ['markets','contracts','results','data','odds']){const value=root[key];if(Array.isArray(value))return value}
 return [];
}

export function normalizePredictionMarkets(payload:unknown,source='prediction-provider'):PredictionContract[]{
 const out:PredictionContract[]=[];
 rows(payload).forEach((value,index)=>{
  const row=obj(value);
  if(Array.isArray(row.outcomes)){
   (row.outcomes as unknown[]).forEach((o,j)=>{
    const outcome=obj(o);const american=num(outcome.odds_american,num(outcome.price,0));const yes=probability(outcome.probability??outcome.odds_probability,american?impliedProbability(american):.5);
    out.push({id:str(outcome.id,`${source}-${index}-${j}`),eventId:str(row.event_id,'')||undefined,title:str(row.event_name,str(row.event,str(row.title,'Contract'))),category:str(row.league,str(row.category,'Sports')),market:str(row.market_type,str(row.market,''))||undefined,selection:str(outcome.selection,str(outcome.name,''))||undefined,yesProbability:yes,noProbability:1-yes,modelProbability:yes,probabilityDifference:0,volume:num(outcome.volume,num(row.volume,0))||undefined,expiresAt:str(row.start_time,str(row.expires_at,''))||undefined,source});
   });
   return;
  }
  const american=num(row.odds_american,num(row.price,0));
  const yes=probability(row.yesProbability??row.yes_probability??row.odds_probability??row.probability,american?impliedProbability(american):.5);
  const model=probability(row.modelProbability??row.model_probability,yes);
  out.push({id:str(row.id,source+'-'+index),eventId:str(row.event_id,str(row.eventId,''))||undefined,title:str(row.title,str(row.question,str(row.event_name,str(row.event,str(row.name,'Contract '+(index+1)))))),category:str(row.category,str(row.league,str(row.group,'Prediction Market'))),market:str(row.market_type,str(row.market,''))||undefined,selection:str(row.selection,str(row.outcome,''))||undefined,yesProbability:yes,noProbability:1-yes,modelProbability:model,probabilityDifference:model-yes,volume:num(row.volume,num(row.liquidity,0))||undefined,expiresAt:str(row.expiresAt,str(row.expires_at,str(row.closeTime,str(row.close_time,str(row.start_time,'')))))||undefined,source});
 });
 return out;
}

async function fetchSharpBook(book:string){
 const key=process.env.SHARP_API_KEY;if(!key)return [] as PredictionContract[];
 const base=process.env.SHARP_API_URL||'https://api.sharpapi.io/api/v1/odds';const url=new URL(base);url.searchParams.set('sportsbook',book);url.searchParams.set('live','false');url.searchParams.set('limit','200');
 const headers:Record<string,string>={Accept:'application/json'};const authHeader=process.env.SHARP_API_AUTH_HEADER||'X-API-Key';headers[authHeader]=authHeader.toLowerCase()==='authorization'?`Bearer ${key}`:key;
 const res=await fetch(url,{headers,cache:'no-store'});if(!res.ok)throw new Error(`SharpAPI ${book} HTTP ${res.status}`);return normalizePredictionMarkets(await res.json(),`SharpAPI:${book}`);
}

export async function fetchPredictionMarkets(){
 if(process.env.SHARP_API_KEY){
  const books=(process.env.SHARP_PREDICTION_BOOKS||'kalshi,polymarket').split(',').map(x=>x.trim()).filter(Boolean);
  const settled=await Promise.allSettled(books.map(fetchSharpBook));
  const contracts=settled.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  if(contracts.length)return {mode:'live',source:'SharpAPI prediction markets',contracts,attempts:settled.map((x,i)=>({providerId:`sharp-${books[i]}`,ok:x.status==='fulfilled'}))};
 }
 const result=await fetchWithFailover('PREDICTION_MARKETS');
 if(!result.ok)return {mode:result.attempts.length?'failed':'unconfigured',source:null,contracts:[] as PredictionContract[],attempts:result.attempts,error:result.error};
 const source=result.providerName||result.providerId||'prediction-provider';
 return {mode:'live',source,contracts:normalizePredictionMarkets(result.data,source),attempts:result.attempts};
}
