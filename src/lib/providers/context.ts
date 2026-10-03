import {fetchWithFailover,type FailoverResult} from './failover';
import type {ProviderCapability} from '../providerRegistry';

type Cached={at:number;value:FailoverResult<unknown>};
const cache=new Map<ProviderCapability,Cached>();

const ttl=(capability:ProviderCapability)=>{
 const raw=capability==='WEATHER'
  ?process.env.WEATHER_CONTEXT_CACHE_MS
  :capability==='INJURIES'
   ?process.env.INJURY_CONTEXT_CACHE_MS
   :capability==='STATS'
    ?process.env.STATS_CONTEXT_CACHE_MS
    :process.env.CONTEXT_PROVIDER_CACHE_MS;
 const fallback=capability==='INJURIES'?180000:capability==='WEATHER'?600000:900000;
 const n=Number(raw);
 return Number.isFinite(n)?Math.max(30000,n):fallback;
};

async function cached(capability:ProviderCapability,force=false){
 const hit=cache.get(capability);
 const maxAge=ttl(capability);
 if(!force&&hit&&Date.now()-hit.at<maxAge)return hit.value;
 const value=await fetchWithFailover(capability);
 cache.set(capability,{at:Date.now(),value});
 return value;
}

export async function fetchWeatherContext(force=false){return cached('WEATHER',force);}
export async function fetchInjuryContext(force=false){return cached('INJURIES',force);}
export async function fetchStatsContext(force=false){return cached('STATS',force);}
export async function fetchResultsContext(force=false){return cached('RESULTS',force);}
export async function fetchPredictionMarketContext(force=false){return cached('PREDICTION_MARKETS',force);}
