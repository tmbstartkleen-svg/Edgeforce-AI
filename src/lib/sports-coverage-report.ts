import {reconcileCoverage,type CoverageObservation,type CoverageTarget} from './coverage-inventory';

export type CoverageDiscoveryBatch={
 provider:string;sourceTimestamp:string;observations:CoverageObservation[];
 expected:CoverageTarget[];
 quota?:{remaining:number;limit:number;resetAt?:string};
};
const norm=(s:string)=>s.trim().toLowerCase();
const id=(sport:string,league:string)=>norm(sport)+'|'+norm(league);
/** Produce source-backed league/event/market coverage diagnostics across provider batches.
 * Expected inventory is evidence-based, never inferred from a fixed catalog.
 */
export function buildSportsCoverageReport(input:{
 batches:CoverageDiscoveryBatch[];asOf:string;bookmaker:string;maxAgeMs:number;
}){
 const now=Date.parse(input.asOf);
 if(!Number.isFinite(now)||!Number.isSafeInteger(input.maxAgeMs)||input.maxAgeMs<=0)
  throw new Error('INVALID_REPORT_WINDOW');
 const observations:CoverageObservation[]=[];
 const expected:CoverageTarget[]=[];
 const providers:{name:string;asOf:string;state:'FRESH'|'STALE'|'INVALID';quota?:CoverageDiscoveryBatch['quota'];events:number}[]=[];
 for(const batch of input.batches){
  if(!batch||typeof batch.provider!=='string'||!batch.provider.trim()||
     !Array.isArray(batch.observations)||!Array.isArray(batch.expected))throw new Error('INVALID_PROVIDER_BATCH');
  const seen=Date.parse(batch.sourceTimestamp);
  const state=!Number.isFinite(seen)||seen>now?'INVALID':now-seen>input.maxAgeMs?'STALE':'FRESH';
  const quota=batch.quota;
  if(quota&&(!Number.isSafeInteger(quota.limit)||!Number.isSafeInteger(quota.remaining)||
    quota.limit<0||quota.remaining<0||quota.remaining>quota.limit))throw new Error('INVALID_QUOTA');
  providers.push({name:batch.provider,asOf:batch.sourceTimestamp,state,quota,events:new Set(batch.observations.map(x=>x.eventId)).size});
  if(state==='FRESH'){
   observations.push(...batch.observations.filter(x=>x.provider===batch.provider));
   expected.push(...batch.expected);
  }
 }
 const report=reconcileCoverage({observations,expected,now:input.asOf,maxAgeMs:input.maxAgeMs,targetBookmaker:input.bookmaker});
 const leagues=new Map<string,{sport:string;league:string;events:Set<string>;markets:Set<string>;expected:number;matched:number;missing:number}>();
 const row=(sport:string,league:string)=>{
  const k=id(sport,league);
  let item=leagues.get(k);
  if(!item){item={sport,league,events:new Set(),markets:new Set(),expected:0,matched:0,missing:0};leagues.set(k,item);}
  return item;
 };
 for(const item of report.observations){const x=row(item.sport,item.league);x.events.add(item.eventId);x.markets.add(item.marketType);}
 const wanted=new Set<string>();
 for(const target of expected){
  if(norm(target.bookmaker)!==norm(input.bookmaker))continue;
  const k=[target.bookmaker,target.sport,target.league,target.eventId,target.marketType,target.playerId||'',target.outcomeId,target.line||''].map(norm).join('|');
  if(wanted.has(k))continue;
  wanted.add(k);row(target.sport,target.league).expected++;
 }
 for(const item of report.unmatched)row(item.target.sport,item.target.league).missing++;
 for(const x of leagues.values())x.matched=x.expected-x.missing;
 return {
  asOf:report.asOf,bookmaker:report.bookmaker,
  totals:{...report.observed,expected:report.expected,matched:report.matched,missing:report.missing},
  providers,leagues:[...leagues.values()].map(x=>({sport:x.sport,league:x.league,events:x.events.size,marketTypes:x.markets.size,expected:x.expected,matched:x.matched,missing:x.missing})).sort((a,b)=>b.missing-a.missing||a.sport.localeCompare(b.sport)||a.league.localeCompare(b.league)),
  missingMarkets:report.unmatched,rejected:report.rejected,
  coverageComplete:providers.length>0&&providers.every(x=>x.state==='FRESH')&&report.complete,
  provenanceNote:'No missing DraftKings catalog items are guessed. Inventory reflects authorized provider batches only.'
 };
}
