/**
 * Offline report for player-identity candidates extracted from a supplied
 * The Odds API payload. No stable athlete IDs are invented. Matching a
 * supplied roster is a research lead, not executable DraftKings coverage.
 */
import {reconcilePlayerProps,type AthleteDirectoryEntry,type ProvisionalProp} from './draftkings-player-identity-reconciliation';
type Dict=Record<string,unknown>;
const obj=(v:unknown):v is Dict=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
export function auditOddsExportPlayerIdentities(events:unknown,roster:AthleteDirectoryEntry[],now=Date.now()){
 if(!Array.isArray(events)||events.length>500||!Array.isArray(roster)||
  !Number.isFinite(now))throw Error('INVALID_PROVIDER_PLAYER_EXPORT');
 const props:ProvisionalProp[]=[];
 const rejections:Record<string,number>={};
 const reject=(r:string)=>{rejections[r]=(rejections[r]||0)+1};
 let scanned=0;
 for(const event of events){
  if(!obj(event)||!str(event.id)||!str(event.sport_key)||!str(event.commence_time)||
   !Number.isFinite(Date.parse(event.commence_time))||
   Date.parse(event.commence_time)<=now){reject('INVALID_EVENT');continue}
  const books=Array.isArray(event.bookmakers)?event.bookmakers:[];
  if(books.length>100){reject('TOO_MANY_BOOKMAKERS');continue}
  for(const book of books){
   if(!obj(book)||book.key!=='draftkings')continue;
   const markets=Array.isArray(book.markets)?book.markets:[];
   if(markets.length>250){reject('TOO_MANY_MARKETS');continue}
   for(const market of markets){
    if(!obj(market)||!str(market.key)||!/^player_[a-z0-9_]+$/.test(market.key))continue;
    const outcomes=Array.isArray(market.outcomes)?market.outcomes:[];
    if(outcomes.length>500){reject('TOO_MANY_OUTCOMES');continue}
    const observedAt=market.last_update??book.last_update;
    for(const outcome of outcomes){
     scanned++;
     if(!obj(outcome)||!str(outcome.description)||!str(outcome.name)||
      typeof outcome.point!=='number'||!Number.isFinite(outcome.point)||
      typeof outcome.price!=='number'||!Number.isSafeInteger(outcome.price)||
      Math.abs(outcome.price)<100||Math.abs(outcome.price)>100000||
      !str(observedAt)){
      reject('INVALID_PLAYER_OUTCOME');continue
     }
     if(props.length>=5000){reject('PROP_LIMIT_REACHED');continue}
     props.push({eventId:event.id,sport:event.sport_key,
      league:str(event.sport_title)?event.sport_title:event.sport_key,
      athleteName:outcome.description,marketType:market.key,
      outcomeId:outcome.name,americanOdds:outcome.price,
      observedAt,startsAt:event.commence_time,line:String(outcome.point)});
    }
   }
  }
 }
 const result=reconcilePlayerProps(props,roster,now);
 return {mode:'ODDS_EXPORT_PROVISIONAL_PLAYER_ID_AUDIT' as const,
  examinedProviderOutcomes:scanned,extractedPlayerProps:props.length,
  providerRejections:rejections,...result,certifiedProps:0,
  providerRightsVerified:false,rosterProvenanceVerified:false,
  releaseCertified:false};
}
