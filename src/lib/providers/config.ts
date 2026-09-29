import type {ProviderConfig} from './types';
import type {ProviderCapability} from '../providerRegistry';

const int=(v:string|undefined,fallback:number)=>{
 const n=Number(v);
 return Number.isFinite(n)?n:fallback;
};

function provider(prefix:string,name:string,capability:ProviderCapability,priority:number):ProviderConfig|null{
 const url=process.env[`${prefix}_URL`];
 if(!url)return null;
 return {
  id:prefix.toLowerCase().replace(/_/g,'-'),
  name,
  capability,
  url,
  apiKey:process.env[`${prefix}_KEY`],
  authHeader:process.env[`${prefix}_AUTH_HEADER`]||'Authorization',
  authScheme:process.env[`${prefix}_AUTH_SCHEME`]??'Bearer',
  priority:int(process.env[`${prefix}_PRIORITY`],priority),
  timeoutMs:int(process.env[`${prefix}_TIMEOUT_MS`],8000),
  enabled:process.env[`${prefix}_ENABLED`]!=='false',
  bookmaker:process.env[`${prefix}_BOOKMAKER`]||'DraftKings'
 };
}

export function configuredProviders(capability?:ProviderCapability):ProviderConfig[]{
 const all=[
  provider('ODDS_PROVIDER_PRIMARY','Odds Primary','ODDS',100),
  provider('ODDS_PROVIDER_SECONDARY','Odds Secondary','ODDS',80),
  provider('ODDS_PROVIDER_TERTIARY','Odds Tertiary','ODDS',60),
  provider('WEATHER_PROVIDER_PRIMARY','Weather Primary','WEATHER',100),
  provider('WEATHER_PROVIDER_SECONDARY','Weather Secondary','WEATHER',80),
  provider('INJURY_PROVIDER_PRIMARY','Injury Primary','INJURIES',100),
  provider('INJURY_PROVIDER_SECONDARY','Injury Secondary','INJURIES',80),
  provider('STATS_PROVIDER_PRIMARY','Stats Primary','STATS',100),
  provider('RESULTS_PROVIDER_PRIMARY','Results Primary','RESULTS',100),
  provider('PREDICTION_PROVIDER_PRIMARY','Prediction Market Primary','PREDICTION_MARKETS',100)
 ].filter((x):x is ProviderConfig=>Boolean(x&&x.enabled));
 return capability?all.filter(x=>x.capability===capability):all;
}
