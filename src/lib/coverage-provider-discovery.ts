import type {CoverageObservation,CoverageTarget} from './coverage-inventory';
import type {CoverageDiscoveryBatch} from './sports-coverage-report';
export type ProviderCatalogEvent={
 id:string;sport:string;league:string;startsAt:string;
 markets:{type:string;outcomes:{id:string;playerId?:string;line?:string;bookmakers:{name:string;americanOdds?:number}[]}[]}[];
};
export type ProviderCatalog={provider:string;fetchedAt:string;events:ProviderCatalogEvent[];quota?:{remaining:number;limit:number;resetAt?:string}};
const nonempty=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0;
const date=(s:string)=>Number.isFinite(Date.parse(s));
/** Adapt an authorized provider's enumerated catalog; never invent a missing DK quote. */
export function normalizeProviderCatalog(catalog:ProviderCatalog,bookmaker='DraftKings'):CoverageDiscoveryBatch{
 if(!catalog||!nonempty(catalog.provider)||!nonempty(catalog.fetchedAt)||!date(catalog.fetchedAt)||!Array.isArray(catalog.events))
  throw new Error('INVALID_PROVIDER_CATALOG');
 const observations:CoverageObservation[]=[];
 const expected:CoverageTarget[]=[];
 const seen=new Set<string>();
 for(const event of catalog.events){
  if(!event||!nonempty(event.id)||!nonempty(event.sport)||!nonempty(event.league)||!nonempty(event.startsAt)||!date(event.startsAt)||!Array.isArray(event.markets))
   throw new Error('INVALID_CATALOG_EVENT');
  for(const market of event.markets){
   if(!market||!nonempty(market.type)||!Array.isArray(market.outcomes))throw new Error('INVALID_CATALOG_MARKET');
   for(const outcome of market.outcomes){
    if(!outcome||!nonempty(outcome.id)||!Array.isArray(outcome.bookmakers))throw new Error('INVALID_CATALOG_OUTCOME');
    for(const book of outcome.bookmakers){
     if(!book||!nonempty(book.name))throw new Error('INVALID_CATALOG_BOOKMAKER');
     if(book.name.trim().toLowerCase()!==bookmaker.trim().toLowerCase())continue;
     const target:CoverageTarget={bookmaker:book.name,sport:event.sport,league:event.league,eventId:event.id,marketType:market.type,outcomeId:outcome.id,...(outcome.playerId?{playerId:outcome.playerId}:{}),...(outcome.line?{line:outcome.line}:{})};
     const key=[target.bookmaker,target.sport,target.league,target.eventId,target.marketType,target.playerId||'',target.outcomeId,target.line||''].map(s=>s.trim().toLowerCase()).join('|');
     if(!seen.has(key)){expected.push(target);seen.add(key);}
     if(book.americanOdds!==undefined)
      observations.push({...target,provider:catalog.provider,observedAt:catalog.fetchedAt,startsAt:event.startsAt,priceAmerican:book.americanOdds});
    }
   }
  }
 }
 return {provider:catalog.provider,sourceTimestamp:catalog.fetchedAt,observations,expected,quota:catalog.quota};
}
