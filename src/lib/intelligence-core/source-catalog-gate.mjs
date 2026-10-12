/**
 * Source catalog gate for sport and non-sport observations.
 * Classifies provenance and refuses to treat unverified sources as live coverage.
 * No external requests, credentials, or collection side effects.
 */
import {SPORT_DOMAINS,NON_SPORTS_MARKETS} from './specialist-network.mjs';
const sports=new Set(SPORT_DOMAINS),events=new Set(NON_SPORTS_MARKETS);
export function qualifySource(source){
 if(!source||typeof source!=='object')throw Error('INVALID_SOURCE');
 const {sourceId,upstreamId,division,domain,licenseApproved,enabled,
  observedAt,permissionScope}=source;
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(String(sourceId??'')))throw Error('INVALID_SOURCE_ID');
 if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(String(upstreamId??'')))throw Error('INVALID_UPSTREAM_ID');
 if(division==='SPORTS'?!sports.has(domain):
    division==='PREDICTION_MARKETS'?!events.has(domain):true)throw Error('INVALID_SOURCE_DOMAIN');
 if(licenseApproved!==true||enabled!==true)throw Error('SOURCE_NOT_APPROVED');
 if(!['READ_PUBLIC_API','READ_LICENSED_API'].includes(permissionScope))throw Error('SOURCE_SCOPE_NOT_APPROVED');
 if(typeof observedAt!=='number'||!Number.isFinite(observedAt))throw Error('SOURCE_TIMESTAMP_REQUIRED');
 return Object.freeze({sourceId,upstreamId,division,domain,permissionScope,observedAt,
  independentUpstreams:1,coverage:'SOURCE_APPROVED_NOT_LIVE_CERTIFIED'});
}
export function planSourceCollection({sources=[],limit=5,now=Date.now(),maxAgeMs=300000}={}){
 if(!Array.isArray(sources)||!Number.isInteger(limit)||limit<0||limit>20)throw Error('INVALID_COLLECTION_PLAN');
 const approved=[],rejected=[];
 for(const source of sources.slice(0,100)){
  try{
   const validated=qualifySource(source);
   if(validated.observedAt>now+30000||now-validated.observedAt>maxAgeMs)throw Error('SOURCE_TIMESTAMP_STALE');
   if(approved.length>=limit)throw Error('SOURCE_QUOTA_REACHED');
   approved.push(validated);
  }catch(error){rejected.push({sourceId:String(source?.sourceId??'unknown'),reason:error instanceof Error?error.message:'INVALID_SOURCE'});}
 }
 return {mode:'PLAN_ONLY_NO_FETCH',approved,rejected,sourceCount:approved.length,
  actualMarketsScanned:0,actualSportsCovered:0,actualNonSportsCategoriesCovered:0};
}
