import {prepareTheOddsApiD1Batch,type PreparedOddsObservation} from './the-odds-api-d1-preparation';

/**
 * No-write preflight of a supplied The Odds API response. Does not invoke the
 * provider, read credentials, write D1, register sources or certify entitlements.
 * A single response is insufficient to prove full sportsbook market coverage.
 */
export function assessOddsIngestionPreflight(events:unknown,now=Date.now(),options:{playerPropDryRun?:boolean;targetBookmaker?:string}={}){
 const prepared=prepareTheOddsApiD1Batch(events,now,25,{enablePlayerProps:options.playerPropDryRun===true});
 const target=(options.targetBookmaker||'DraftKings').trim().toLowerCase();
 if(!target||target.length>80)throw Error('INVALID_TARGET_BOOKMAKER');
 const quotes=prepared.rows.filter(r=>r.value.bookmaker.trim().toLowerCase()===target);
 const distinct=(records:PreparedOddsObservation[],select:(r:PreparedOddsObservation)=>string)=>
  new Set(records.map(select)).size;
 const marketIdentity=(r:PreparedOddsObservation)=>JSON.stringify([
  r.value.bookmaker.trim().toLowerCase(),r.value.sport,r.value.league,r.eventId,
  r.value.marketType,r.value.playerId||'',r.value.outcomeId,r.value.line||''
 ]);
 const keys=new Set<string>();const duplicateKeys=new Set<string>();
 for(const r of quotes){
  const key=marketIdentity(r);
  if(keys.has(key))duplicateKeys.add(key);
  keys.add(key);
 }
 const props=quotes.filter(r=>r.value.marketType.startsWith('player_'));
 const provisionalProps=props.filter(r=>r.value.playerIdentityStatus==='UNVERIFIED_NAME_ONLY');
 const missingLineProps=props.filter(r=>!r.value.line||!r.value.playerId);
 const bySport=new Map<string,{sport:string;league:string;events:Set<string>;markets:Set<string>;outcomes:Set<string>;props:number}>();
 for(const r of quotes){
  const k=JSON.stringify([r.value.sport,r.value.league]);
  let g=bySport.get(k);
  if(!g){g={sport:r.value.sport,league:r.value.league,events:new Set(),markets:new Set(),outcomes:new Set(),props:0};bySport.set(k,g);}
  g.events.add(r.eventId);g.markets.add(r.value.marketType);g.outcomes.add(marketIdentity(r));
  if(r.value.marketType.startsWith('player_'))g.props++;
 }
 const leagues=[...bySport.values()].map(g=>({sport:g.sport,league:g.league,
  observedEvents:g.events.size,observedMarketTypes:g.markets.size,observedOutcomes:g.outcomes.size,provisionalPlayerPropQuotes:g.props}))
  .sort((a,b)=>a.sport.localeCompare(b.sport)||a.league.localeCompare(b.league));
 const gates={
  authenticUpstreamEvidence:{passed:false,reason:'INPUT_NOT_AUTHENTICATED_TO_PROVIDER'},
  sourceEntitlement:{passed:false,reason:'SOURCE_ENTITLEMENT_NOT_VERIFIED'},
  validPreparedPriceRows:{passed:quotes.length>0,count:quotes.length},
  unambiguousTargetQuoteIdentity:{passed:duplicateKeys.size===0,count:duplicateKeys.size},
  stablePlayerIdentity:{passed:props.length>0&&provisionalProps.length===0&&missingLineProps.length===0,
   reason:props.length===0?'NO_PLAYER_PROPS':provisionalProps.length>0?'PROVISIONAL_PLAYER_NAMES':missingLineProps.length>0?'INVALID_PROP_IDENTITY':null},
  independentSourceAgreement:{passed:false,reason:'SINGLE_UPSTREAM_PREPARATION'},
  D1Persistence:{passed:false,reason:'NO_D1_WRITES_PERFORMED'},
  fullMarketCatalog:{passed:false,reason:'NO_AUTHORIZED_EXPECTED_CATALOG'},
 };
 return {mode:'NO_WRITE_PREFLIGHT' as const,certified:false,targetBookmaker:options.targetBookmaker||'DraftKings',
  preparedCount:prepared.prepared,targetQuoteCount:quotes.length,otherBookmakerCount:prepared.rows.length-quotes.length,
  distinctTargetOutcomes:keys.size,duplicateTargetIdentities:duplicateKeys.size,
  sports:distinct(quotes,r=>r.value.sport),leagues,provisionalPlayerPropQuotes:provisionalProps.length,
  unmappedMarketTypes:prepared.unmappedMarketTypes,rejected:prepared.rejected,
  gates,passes:Object.values(gates).filter(g=>g.passed).length,totalGates:Object.keys(gates).length,
  warning:'Input is caller supplied. This report proves neither live connectivity, sportsbook authorization, executable prices, complete market coverage nor successful D1 ingestion.'};
}
