/**
 * Stage 3 catalog-drift comparison. Maintains accountability for newly offered
 * and withdrawn DraftKings leagues/markets/player-prop lines without treating
 * one provider snapshot as the complete DraftKings universe.
 * A missing outcome in the latest catalog is a coverage investigation, not
 * proof the sportsbook removed it.
 */
import type {RequiredMarket} from './draftkings-market-gap-audit';
export type CatalogSnapshot={asOf:string;sourceId:string;required:RequiredMarket[]};
const valid=(x:unknown)=>typeof x==='string'&&x.trim().length>0;
const id=(r:RequiredMarket)=>JSON.stringify([
 r.sport.trim().toLowerCase(),r.league.trim().toLowerCase(),
 r.marketType.trim().toLowerCase(),r.kind,
 (r.eventId||'').trim().toLowerCase(),(r.playerId||'').trim().toLowerCase(),
 (r.line||'').trim().toLowerCase()
]);
function normalize(snapshot:CatalogSnapshot,now:number){
 if(!snapshot||!valid(snapshot.sourceId)||!Array.isArray(snapshot.required)||
  snapshot.required.length>5000)throw Error('INVALID_CATALOG_SNAPSHOT');
 const time=Date.parse(snapshot.asOf);
 if(!Number.isFinite(time)||time>now)throw Error('INVALID_CATALOG_TIMESTAMP');
 const seen=new Map<string,RequiredMarket>();let duplicates=0,invalid=0;
 for(const r of snapshot.required){
  if(!r||![r.sport,r.league,r.marketType].every(valid)||
    (r.kind!=='game'&&r.kind!=='player-prop')||
    (r.eventId!==undefined&&!valid(r.eventId))||
    (r.playerId!==undefined&&!valid(r.playerId))||
    (r.line!==undefined&&!valid(r.line))){
   invalid++;continue;
  }
  const key=id(r);
  if(seen.has(key)){duplicates++;continue}
  seen.set(key,r);
 }
 return {asOf:time,seen,duplicates,invalid};
}
export function compareDraftKingsCatalogSnapshots(
 before:CatalogSnapshot,after:CatalogSnapshot,now=Date.now()
){
 if(!Number.isFinite(now))throw Error('INVALID_CATALOG_TIME');
 const prev=normalize(before,now),next=normalize(after,now);
 if(next.asOf<=prev.asOf)throw Error('CATALOG_TIME_NOT_MONOTONIC');
 const added=[...next.seen].filter(([key])=>!prev.seen.has(key)).map(([,r])=>r);
 const missing=[...prev.seen].filter(([key])=>!next.seen.has(key)).map(([,r])=>r);
 const retained=[...next.seen].filter(([key])=>prev.seen.has(key)).length;
 const types=(items:RequiredMarket[])=>items.reduce((acc,r)=>{
  const type=r.kind==='player-prop'?'playerProps':'gameMarkets';
  acc[type]++;return acc;
 },{playerProps:0,gameMarkets:0});
 return {mode:'DRAFTKINGS_CATALOG_DRIFT_RESEARCH' as const,
  olderAsOf:before.asOf,newerAsOf:after.asOf,
  oldSource:before.sourceId,newSource:after.sourceId,
  sameSource:before.sourceId.trim().toLowerCase()===after.sourceId.trim().toLowerCase(),
  previousCount:prev.seen.size,currentCount:next.seen.size,retained,
  addedCount:added.length,missingCount:missing.length,
  addedByType:types(added),missingByType:types(missing),
  added,missing,
  invalidPrevious:prev.invalid,invalidCurrent:next.invalid,
  duplicatePrevious:prev.duplicates,duplicateCurrent:next.duplicates,
  requiresCatalogReview:added.length>0||missing.length>0||prev.invalid>0||next.invalid>0||
   prev.duplicates>0||next.duplicates>0||before.sourceId!==after.sourceId,
  externallyAuthenticated:false,releaseCertified:false,
  note:'Changes reflect supplied expected catalogs, not actual sportsbook availability. Before claiming removal, confirm feed completeness, snapshot scope, and market closures.'};
}
