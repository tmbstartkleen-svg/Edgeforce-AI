/**
 * Exact no-write reconciliation of prepared sportsbook observations against
 * persisted D1 rows. Caller must provide separately read, authorized rows.
 * This module never fetches providers or performs D1 reads/writes itself.
 */
import type {PreparedOddsObservation} from './the-odds-api-d1-preparation';
export type StoredOddsRow={
 source_id:string;upstream_id:string;event_id:string;market_id:string|null;
 observation_kind:string;observed_at:string;payload:string;
};
const canon=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase():'';
const time=(v:unknown)=>typeof v==='string'?Date.parse(v):NaN;
const validPrice=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&Math.abs(v)>=100&&Math.abs(v)<=100000;
type Quote={bookmaker:string;sport:string;league:string;marketType:string;outcomeId:string;startsAt:string;priceAmerican:number;playerId?:string;line?:string};
const quoteKey=(source:string,upstream:string,event:string,market:string,observed:number,q:Quote)=>
 JSON.stringify([source,upstream,event,market,observed,
  canon(q.bookmaker),canon(q.sport),canon(q.league),canon(q.marketType),
  canon(q.outcomeId),canon(q.playerId),canon(q.line),time(q.startsAt),q.priceAmerican]);
export function verifyPreparedOddsReadback(expected:PreparedOddsObservation[],stored:StoredOddsRow[],now=Date.now()){
 if(!Array.isArray(expected)||expected.length>25||!Array.isArray(stored)||stored.length>250||!Number.isFinite(now))
  throw Error('INVALID_ODDS_READBACK_LIMIT');
 const expectedKeys=new Set<string>(),persistedKeys=new Map<string,number>();
 const rejected:Record<string,number>={};
 const reject=(k:string)=>{rejected[k]=(rejected[k]||0)+1;};
 for(const e of expected){
  if(!e||e.kind!=='odds'||!validPrice(e.value?.priceAmerican)||!e.provider||!e.upstreamId||!e.eventId||
    !e.marketId||!Number.isFinite(e.observedAt)||e.observedAt>now||now-e.observedAt>15*60*1000||
    !Number.isFinite(time(e.value.startsAt))||time(e.value.startsAt)<=now){
   reject('INVALID_EXPECTED_QUOTE');continue;
  }
  const k=quoteKey(e.provider,e.upstreamId,e.eventId,e.marketId,e.observedAt,e.value);
  if(expectedKeys.has(k))reject('DUPLICATE_EXPECTED_QUOTE');
  expectedKeys.add(k);
 }
 for(const r of stored){
  if(!r||r.observation_kind!=='odds'||!r.source_id||!r.upstream_id||!r.event_id||!r.market_id){
   reject('NON_ODDS_OR_MISSING_IDENTITY');continue;
  }
  const observed=time(r.observed_at);
  if(!Number.isFinite(observed)||observed>now||now-observed>15*60*1000){
   reject('STORED_QUOTE_NOT_FRESH');continue;
  }
  let value:unknown;
  try{value=JSON.parse(r.payload)}catch{reject('MALFORMED_STORED_PAYLOAD');continue}
  if(!value||typeof value!=='object'||Array.isArray(value)){
   reject('MALFORMED_STORED_PAYLOAD');continue;
  }
  // D1 writer persists o.value, not the full incoming provider envelope.
  const q=value as Partial<Quote>;
  if(![q.bookmaker,q.sport,q.league,q.marketType,q.outcomeId,q.startsAt].every(x=>typeof x==='string'&&x.trim())||
    !validPrice(q.priceAmerican)||!Number.isFinite(time(q.startsAt))||time(q.startsAt)<=now){
   reject('INVALID_STORED_QUOTE');continue;
  }
  const key=quoteKey(r.source_id,r.upstream_id,r.event_id,r.market_id,observed,q as Quote);
  persistedKeys.set(key,(persistedKeys.get(key)||0)+1);
 }
 let matched=0;
 for(const key of expectedKeys){
  if((persistedKeys.get(key)||0)===1)matched++;
  else reject((persistedKeys.get(key)||0)>1?'AMBIGUOUS_STORED_DUPLICATES':'EXPECTED_QUOTE_MISSING');
 }
 const complete=expectedKeys.size>0&&matched===expectedKeys.size&&
  !rejected.INVALID_EXPECTED_QUOTE&&!rejected.DUPLICATE_EXPECTED_QUOTE&&!rejected.AMBIGUOUS_STORED_DUPLICATES;
 return {mode:'READ_ONLY_ODDS_RECONCILIATION' as const,
  readbackMatches:matched,expectedQuotes:expectedKeys.size,storedRowsInspected:stored.length,
  exactReadbackComplete:Boolean(complete),
  releaseCertified:false,
  rejected,
  warning:'Matching quotes does not establish provider entitlement, independent verification, complete market coverage or release readiness.'};
}
