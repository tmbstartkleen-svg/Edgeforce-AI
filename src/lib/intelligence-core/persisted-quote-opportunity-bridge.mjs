import {scanArbitrage,screenValueEdges} from './market-opportunity-engine.mjs';

/** Converts existing persisted sportsbook rows into auditable market evidence.
 * Refuses to infer settlement, market exhaustiveness, provider ownership or observation timestamps.
 */
export function normalizePersistedQuoteEvidence(rows,{now=Date.now(),maxRows=10000}={}){
 if(!Array.isArray(rows)||!Number.isFinite(now)||!Number.isInteger(maxRows)||maxRows<0||maxRows>10000)
  throw new TypeError('INVALID_STORED_QUOTE_ROWS');
 const quotes=[],rejected=[];
 for(const row of rows.slice(0,maxRows)){
  const raw=row?.raw && typeof row.raw==='object' && !Array.isArray(row.raw)?row.raw:{};
  const reason=(code)=>{rejected.push({reason:code});};
  const eventId=raw.sourceEventId;
  const settlementKey=raw.settlementKey;
  const outcomeSetType=raw.outcomeSetType;
  const outcomes=raw.outcomes;
  const selection=row?.selection_key;
  const bookmaker=row?.bookmaker;
  const providerId=row?.provider;
  const upstreamId=raw.upstreamId;
  const marketKey=row?.market_key;
  const odds=Number(row?.american_odds);
  const sourceTime=typeof raw.sourceTimestamp==='string'?Date.parse(raw.sourceTimestamp):NaN;
  const storedTime=Date.parse(row?.pulled_at);
  if(![eventId,settlementKey,selection,bookmaker,providerId,upstreamId,marketKey].every(x=>typeof x==='string'&&x.trim())||
   !['TWO_WAY','THREE_WAY'].includes(outcomeSetType)||!Array.isArray(outcomes)||
   !Number.isFinite(sourceTime)||!Number.isFinite(storedTime)||!Number.isInteger(odds)||Math.abs(odds)<100){
   reason('INCOMPLETE_PERSISTED_PROVENANCE_OR_SETTLEMENT');continue;
  }
  // The original source time cannot be later than receipt; clock-skew allowance is one minute.
  if(sourceTime>storedTime+60000||sourceTime>now+60000){reason('FUTURE_SOURCE_OBSERVATION');continue;}
  if(raw.venueType!=='SPORTSBOOK'||(raw.side&&raw.side!=='BACK')){reason('UNSUPPORTED_VENUE_OR_SIDE');continue;}
  quotes.push({eventId,marketKey,settlementKey,currency:raw.currency==='USD'?'USD':raw.currency,
   venueType:'SPORTSBOOK',side:'BACK',outcomeSetType,outcomes,selection,
   bookmaker,providerId,upstreamId,observedAt:sourceTime,odds});
 }
 return {quotes,rejectedCount:rejected.length,rejectionReasons:rejected.reduce((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{}),
  sourceRowsExamined:Math.min(rows.length,maxRows),databaseWrites:0,externalRequests:0};
}

/** No source aliases, fake payouts, or silently inferred model forecasts. */
export function analyzePersistedQuoteEvidence(rows,forecasts=[],options={}){
 const normalized=normalizePersistedQuoteEvidence(rows,options);
 const arbitrage=scanArbitrage(normalized.quotes,options);
 const value=screenValueEdges(normalized.quotes,forecasts,options);
 return {mode:'PERSISTED_VERIFIED_EVIDENCE_ONLY',normalized,arbitrage,value,
  actionableBetsAutomaticallyCreated:0,realOddsFabricated:0,
  limitations:['Unverified source ownership or missing settlement evidence excludes quotes.',
   'Persisted quote timestamps must derive from the actual provider observation.',
   'Arbitrage is theoretical until both venues independently confirm accepted prices, fees, limits and payout rules.']};
}
