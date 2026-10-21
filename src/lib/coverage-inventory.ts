/** Provider-agnostic, evidence-only market coverage reconciliation.
 * No synthetic sportsbook quotes or hardcoded league catalogs.
 */
export type CoverageObservation={
 provider:string; bookmaker:string; sport:string; league:string; eventId:string;
 marketType:string; outcomeId:string; observedAt:string; startsAt:string;
 line?:string; priceAmerican?:number; playerId?:string;
};
export type CoverageTarget={sport:string;league:string;eventId:string;marketType:string;outcomeId:string;bookmaker:string;playerId?:string;line?:string};
const clean=(value:string)=>value.trim().toLowerCase();
const validTime=(value:string)=>Number.isFinite(Date.parse(value));
const key=(x:CoverageTarget)=>[x.bookmaker,x.sport,x.league,x.eventId,x.marketType,x.playerId||'',x.outcomeId,x.line||''].map(clean).join('|');
export function reconcileCoverage(input:{
 observations:CoverageObservation[]; expected:CoverageTarget[];
 now:string;maxAgeMs:number;targetBookmaker:string;
}){
 const {observations,expected,maxAgeMs,targetBookmaker}=input;
 const now=Date.parse(input.now);
 if(!Number.isFinite(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||maxAgeMs>86400000)
  throw new Error('INVALID_COVERAGE_WINDOW');
 const accepted=new Map<string,CoverageObservation>();
 const rejected:{reason:string;observation:CoverageObservation}[]=[];
 for(const o of observations){
  if(!o||![o.provider,o.bookmaker,o.sport,o.league,o.eventId,o.marketType,o.outcomeId,o.observedAt,o.startsAt].every(v=>typeof v==='string'&&v.trim())||
   !validTime(o.observedAt)||!validTime(o.startsAt)){
   rejected.push({reason:'INVALID_OBSERVATION',observation:o});continue;
  }
  if(clean(o.bookmaker)!==clean(targetBookmaker)){rejected.push({reason:'OTHER_BOOKMAKER',observation:o});continue;}
  const age=now-Date.parse(o.observedAt);
  if(age<0||age>maxAgeMs){rejected.push({reason:'STALE_OR_FUTURE',observation:o});continue;}
  if(o.priceAmerican!==undefined&&(!Number.isInteger(o.priceAmerican)||o.priceAmerican===0||Math.abs(o.priceAmerican)<100)){
   rejected.push({reason:'INVALID_PRICE',observation:o});continue;
  }
  const k=key(o),prior=accepted.get(k);
  if(!prior||Date.parse(prior.observedAt)<Date.parse(o.observedAt))accepted.set(k,o);
 }
 const matched:CoverageObservation[]=[],missing:{target:CoverageTarget;reason:string}[]=[];
 const seenTargets=new Set<string>();
 for(const target of expected){
  if(!target||![target.bookmaker,target.sport,target.league,target.eventId,target.marketType,target.outcomeId].every(v=>typeof v==='string'&&v.trim()))throw new Error('INVALID_TARGET');
  if(clean(target.bookmaker)!==clean(targetBookmaker))continue;
  const k=key(target);
  if(seenTargets.has(k))continue;
  seenTargets.add(k);
  const observed=accepted.get(k);
  if(observed)matched.push(observed);
  else missing.push({target,reason:'NOT_OBSERVED_FROM_AUTHORIZED_FEED'});
 }
 const count=(items:CoverageObservation[],field:'sport'|'league'|'eventId'|'marketType'|'playerId')=>new Set(items.map(x=>x[field]).filter(Boolean).map(x=>clean(x!))).size;
 const available=[...accepted.values()];
 return {
  asOf:new Date(now).toISOString(),bookmaker:targetBookmaker,
  observed:{sports:count(available,'sport'),leagues:count(available,'league'),events:count(available,'eventId'),markets:count(available,'marketType'),players:count(available,'playerId'),outcomes:available.length},
  expected:seenTargets.size,matched:matched.length,missing:missing.length,
  rejected:rejected.reduce<Record<string,number>>((a,x)=>(a[x.reason]=(a[x.reason]||0)+1,a),{}),
  unmatched:missing,observations:available,
  complete:seenTargets.size>0&&missing.length===0,
  disclaimer:'Only licensed/authorized observations count. Missing markets are not inferred as sportsbook offers.'
 };
}
