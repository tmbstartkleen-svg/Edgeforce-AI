import type {Market} from './types';
import type {PredictionContract} from './predictionMarkets';
import {classifyPredictionContract,type PredictionCategory} from './predictionCategories';

export type EdgeforceDomain='SPORTS'|'MARKETS';
export type EdgeforceVenueType='SPORTSBOOK'|'PREDICTION_EXCHANGE'|'PREDICTION_PROVIDER';

export type UniversalMarketQuote={
 id:string;
 domain:EdgeforceDomain;
 venue:string;
 venueType:EdgeforceVenueType;
 category:string;
 title:string;
 event?:string;
 selection?:string;
 market?:string;
 startTime?:string;
 yesProbability?:number;
 noProbability?:number;
 impliedProbability:number;
 modelProbability:number;
 edge:number;
 americanOdds?:number;
 bidProbability?:number;
 askProbability?:number;
 volume?:number;
 liquidity?:number;
 expiresAt?:string;
 analyticsOnly:true;
 executionEnabled:false;
};

export type VenueCapability={
 venue:string;
 domain:EdgeforceDomain|'BOTH';
 venueType:EdgeforceVenueType;
 dataRole:'LIVE_ODDS'|'PREDICTION_MARKETS'|'BOTH';
 executionEnabled:false;
 note:string;
};

export const VENUE_CAPABILITIES:VenueCapability[]=[
 {venue:'DraftKings',domain:'SPORTS',venueType:'SPORTSBOOK',dataRole:'LIVE_ODDS',executionEnabled:false,note:'Sportsbook pricing/consensus source when exposed by configured odds providers.'},
 {venue:'FanDuel',domain:'SPORTS',venueType:'SPORTSBOOK',dataRole:'LIVE_ODDS',executionEnabled:false,note:'Sportsbook pricing/consensus source when exposed by configured odds providers.'},
 {venue:'Kalshi',domain:'BOTH',venueType:'PREDICTION_EXCHANGE',dataRole:'PREDICTION_MARKETS',executionEnabled:false,note:'Event-contract market data; sports contracts remain in Sports, non-sports contracts route to Markets.'},
 {venue:'Polymarket',domain:'BOTH',venueType:'PREDICTION_EXCHANGE',dataRole:'PREDICTION_MARKETS',executionEnabled:false,note:'Event-contract market data; sports contracts remain in Sports, non-sports contracts route to Markets.'}
];

function clampProbability(value:number){
 return Math.max(.001,Math.min(.999,Number.isFinite(value)?value:.5));
}

function venueType(source:string):EdgeforceVenueType{
 const value=source.toLowerCase();
 if(value.includes('kalshi')||value.includes('polymarket'))return 'PREDICTION_EXCHANGE';
 return 'PREDICTION_PROVIDER';
}

export function sportsbookQuote(row:Market):UniversalMarketQuote{
 const marketProbability=clampProbability(row.marketProb);
 const modelProbability=clampProbability(row.modelProb);
 return {
  id:'sportsbook:'+row.id,
  domain:'SPORTS',
  venue:row.sourceBook||'Sportsbook',
  venueType:'SPORTSBOOK',
  category:row.sport,
  title:row.event+' · '+row.selection,
  event:row.event,
  selection:row.selection,
  market:row.market,
  startTime:row.startTime,
  impliedProbability:marketProbability,
  modelProbability,
  edge:modelProbability-marketProbability,
  americanOdds:row.odds,
  analyticsOnly:true,
  executionEnabled:false
 };
}

export function predictionQuote(contract:PredictionContract):UniversalMarketQuote{
 const category:PredictionCategory=classifyPredictionContract(contract);
 const domain:EdgeforceDomain=category==='SPORTS'?'SPORTS':'MARKETS';
 const marketProbability=clampProbability(contract.yesProbability);
 const modelProbability=clampProbability(contract.modelProbability);
 return {
  id:'prediction:'+contract.source+':'+contract.id,
  domain,
  venue:contract.source,
  venueType:venueType(contract.source),
  category,
  title:contract.title,
  yesProbability:marketProbability,
  noProbability:1-marketProbability,
  impliedProbability:marketProbability,
  modelProbability,
  edge:modelProbability-marketProbability,
  bidProbability:contract.bidProbability,
  askProbability:contract.askProbability,
  volume:contract.volume,
  liquidity:contract.liquidity,
  expiresAt:contract.expiresAt,
  analyticsOnly:true,
  executionEnabled:false
 };
}

function normalizedWords(value:string){
 return value.toLowerCase()
  .replace(/[^a-z0-9\s]/g,' ')
  .split(/\s+/)
  .filter(Boolean)
  .filter(x=>!['will','the','a','an','to','of','by','on','in','before','after','be','is'].includes(x));
}

export function contractSimilarity(a:UniversalMarketQuote,b:UniversalMarketQuote){
 const aw=new Set(normalizedWords(a.title));
 const bw=new Set(normalizedWords(b.title));
 if(!aw.size||!bw.size)return 0;
 let overlap=0;
 for(const word of aw)if(bw.has(word))overlap++;
 return overlap/Math.max(aw.size,bw.size);
}

export function equivalentContractPair(a:UniversalMarketQuote,b:UniversalMarketQuote){
 if(a.domain!==b.domain||a.venue===b.venue)return {equivalent:false,similarity:0,reason:'different domain or same venue'};
 const similarity=contractSimilarity(a,b);
 const expiryCompatible=!a.expiresAt||!b.expiresAt||Math.abs(new Date(a.expiresAt).getTime()-new Date(b.expiresAt).getTime())<=36*60*60*1000;
 const categoryCompatible=a.category===b.category;
 const equivalent=similarity>=.78&&expiryCompatible&&categoryCompatible;
 return {
  equivalent,
  similarity,
  reason:equivalent?'high text similarity with compatible category/expiry':'requires manual resolution-rule verification'
 };
}

export function buildUniversalSnapshot(sportsbookMarkets:Market[],predictionContracts:PredictionContract[]){
 const sportsbook=sportsbookMarkets.map(sportsbookQuote);
 const prediction=predictionContracts.map(predictionQuote);
 const quotes=[...sportsbook,...prediction];
 return {
  quotes,
  sports:quotes.filter(x=>x.domain==='SPORTS'),
  markets:quotes.filter(x=>x.domain==='MARKETS'),
  capabilities:VENUE_CAPABILITIES,
  analyticsOnly:true as const,
  executionEnabled:false as const
 };
}
