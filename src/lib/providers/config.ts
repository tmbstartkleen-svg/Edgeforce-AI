import type {ProviderConfig,MarketRole} from './types';
import type {ProviderCapability} from '../providerRegistry';
import {sharpApiProvider} from './sharpApi';
import {theRundownProvider} from './theRundown';
import {theRundownResultsProvider} from './theRundownResults';

const int=(v:string|undefined,fallback:number)=>{
 const n=Number(v);
 return Number.isFinite(n)?n:fallback;
};

function role(value:string|undefined):MarketRole{
 const v=(value||'NEUTRAL').toUpperCase();
 return v==='SHARP'||v==='PUBLIC'||v==='REFERENCE'?v:'NEUTRAL';
}
function weight(value:string|undefined,fallback=1){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(.1,Math.min(5,n)):fallback;
}

function defaultMaxAge(capability:ProviderCapability){
 switch(capability){
  case 'ODDS': return 20;
  case 'WEATHER': return 90;
  case 'INJURIES': return 180;
  case 'STATS': return 360;
  case 'RESULTS': return 1440;
  case 'PREDICTION_MARKETS': return 30;
 }
}

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
  bookmaker:process.env[`${prefix}_BOOKMAKER`]||(capability==='ODDS'&&prefix==='ODDS_PROVIDER_PRIMARY'?'DraftKings':name),
  maxAgeMin:int(process.env[`${prefix}_MAX_AGE_MIN`],defaultMaxAge(capability)),
  failureThreshold:Math.max(1,int(process.env[`${prefix}_FAILURE_THRESHOLD`],int(process.env.PROVIDER_FAILURE_THRESHOLD,3))),
  quarantineMin:Math.max(1,int(process.env[`${prefix}_QUARANTINE_MIN`],int(process.env.PROVIDER_QUARANTINE_MIN,5))),
  marketRole:role(process.env[`${prefix}_MARKET_ROLE`]),
  consensusWeight:weight(process.env[`${prefix}_CONSENSUS_WEIGHT`],1)
 };
}

function sportsGameOddsProvider():ProviderConfig|null{
 const key=process.env.SPORTS_GAME_ODDS_API_KEY;
 if(!key)return null;
 return {
  id:'sports-game-odds',
  name:'SportsGameOdds',
  capability:'ODDS',
  url:'sports-game-odds://live-board',
  apiKey:key,
  authHeader:'x-api-key',
  authScheme:'',
  priority:int(process.env.SPORTS_GAME_ODDS_PRIORITY,115),
  timeoutMs:Math.max(2500,int(process.env.SPORTS_GAME_ODDS_TIMEOUT_MS,7000)),
  enabled:process.env.SPORTS_GAME_ODDS_ENABLED!=='false',
  bookmaker:'SportsGameOdds',
  maxAgeMin:Math.max(1,int(process.env.SPORTS_GAME_ODDS_MAX_AGE_MIN,20)),
  failureThreshold:Math.max(1,int(process.env.PROVIDER_FAILURE_THRESHOLD,3)),
  quarantineMin:Math.max(1,int(process.env.PROVIDER_QUARANTINE_MIN,5)),
  marketRole:'REFERENCE',
  consensusWeight:weight(process.env.SPORTS_GAME_ODDS_CONSENSUS_WEIGHT,1)
 };
}

function theOddsApiProvider():ProviderConfig|null{
 const key=process.env.THE_ODDS_API_KEY;
 if(!key)return null;
 return {
  id:'the-odds-api',
  name:'The Odds API',
  capability:'ODDS',
  url:'the-odds-api://live-board',
  apiKey:key,
  authHeader:'X-Api-Key',
  authScheme:'',
  priority:int(process.env.THE_ODDS_API_PRIORITY,120),
  timeoutMs:Math.max(3000,int(process.env.THE_ODDS_API_TIMEOUT_MS,10000)),
  enabled:process.env.THE_ODDS_API_ENABLED!=='false',
  bookmaker:'DraftKings',
  maxAgeMin:Math.max(1,int(process.env.ODDS_PROVIDER_PRIMARY_MAX_AGE_MIN,20)),
  failureThreshold:Math.max(1,int(process.env.PROVIDER_FAILURE_THRESHOLD,3)),
  quarantineMin:Math.max(1,int(process.env.PROVIDER_QUARANTINE_MIN,5)),
  marketRole:'REFERENCE',
  consensusWeight:1
 };
}

export function configuredProviders(capability?:ProviderCapability):ProviderConfig[]{
 const all=[
  theRundownProvider(),
  theRundownResultsProvider(),
  sharpApiProvider(),
  sportsGameOddsProvider(),
  theOddsApiProvider(),
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
