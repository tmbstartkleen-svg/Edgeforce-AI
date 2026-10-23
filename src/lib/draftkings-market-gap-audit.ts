/**
 * Actual-vs-required DraftKings catalog coverage. No catalog is invented:
 * a trusted owner-maintained expected set is required. Fixtures, scores and
 * markets without priced DraftKings outcomes cannot count as odds coverage.
 * Outputs have no bearing on contractual storage rights or betting EV.
 */
export type RequiredMarket={
 sport:string;league:string;marketType:string;
 kind:'game'|'player-prop';eventId?:string;
};
export type ObservedMarket={
 sport:string;league:string;marketType:string;eventId:string;
 bookmaker:string;sourceUpstreamId:string;observedAt:string;startsAt:string;
 outcomeId:string;americanOdds:number;playerId?:string;line?:string;
};
const norm=(v:string)=>v.trim().toLowerCase();
const str=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
const key=(x:{sport:string;league:string;marketType:string})=>
 JSON.stringify([norm(x.sport),norm(x.league),norm(x.marketType)]);
const player=(x:{marketType:string;playerId?:string})=>
 x.marketType.toLowerCase().startsWith('player_')&&str(x.playerId)&&
 !x.playerId!.trim().toLowerCase().startsWith('name:');
export function auditDraftKingsMarketCoverage(
 expected:RequiredMarket[],observed:ObservedMarket[],now=Date.now()
){
 if(!Array.isArray(expected)||expected.length>5000||!Array.isArray(observed)||
  observed.length>50000||!Number.isFinite(now))throw Error('INVALID_COVERAGE_INPUT');
 const requirements=new Map<string,RequiredMarket>();
 const rejected:Record<string,number>={};
 const reject=(reason:string)=>{rejected[reason]=(rejected[reason]||0)+1};
 for(const r of expected){
  if(!r||![r.sport,r.league,r.marketType].every(str)||
   !['game','player-prop'].includes(r.kind)|| (r.eventId!==undefined&&!str(r.eventId))){
   reject('INVALID_REQUIRED_MARKET');continue;
  }
  // Preserve event-scoped requirements distinctly, including two matches
  // in one league that offer entirely different player props.
  const k=JSON.stringify([key(r),r.eventId?norm(r.eventId):'',r.kind]);
  if(requirements.has(k)){reject('DUPLICATE_REQUIRED_MARKET');continue}
  requirements.set(k,r);
 }
 const covered=new Map<string,Set<string>>();
 const upstreams=new Map<string,Set<string>>();
 for(const q of observed){
  if(!q||![q.sport,q.league,q.marketType,q.eventId,q.bookmaker,q.sourceUpstreamId,q.outcomeId].every(str)||
   norm(q.bookmaker)!=='draftkings'||!Number.isSafeInteger(q.americanOdds)||
   Math.abs(q.americanOdds)<100||Math.abs(q.americanOdds)>100000){
   reject('NOT_VALID_DRAFTKINGS_ODDS');continue
  }
  const stamp=Date.parse(q.observedAt),start=Date.parse(q.startsAt);
  if(!Number.isFinite(stamp)||stamp>now||now-stamp>15*60*1000||
   !Number.isFinite(start)||start<=now){reject('STALE_OR_STARTED');continue}
  const isProp=q.marketType.toLowerCase().startsWith('player_');
  if(isProp&&!player(q)){reject('PROVISIONAL_PLAYER_PROP');continue}
  if(q.marketType.toLowerCase()!=='h2h'&&!str(q.line)){
   reject('MISSING_LINE');continue;
  }
  const k=key(q),id=norm(q.eventId);
  if(!covered.has(k))covered.set(k,new Set());
  covered.get(k)!.add(id);
  if(!upstreams.has(k))upstreams.set(k,new Set());
  upstreams.get(k)!.add(norm(q.sourceUpstreamId));
 }
 const missing:Array<{sport:string;league:string;marketType:string;kind:string;
  eventId?:string;reason:string}>=[];
 const satisfied:RequiredMarket[]=[];
 const groupSummary=new Map<string,{sport:string;required:number;covered:number;missing:number}>();
 for(const r of requirements.values()){
  const k=key(r),events=covered.get(k),present=Boolean(
   events&&events.size>0&&(!r.eventId||events.has(norm(r.eventId))));
  const label=norm(r.sport);
  if(!groupSummary.has(label))groupSummary.set(label,{sport:r.sport,required:0,covered:0,missing:0});
  const group=groupSummary.get(label)!;group.required++;
  if(present){satisfied.push(r);group.covered++}
  else {
   group.missing++;
   missing.push({sport:r.sport,league:r.league,marketType:r.marketType,kind:r.kind,
    ...(r.eventId?{eventId:r.eventId}:{}),
    reason:events?.size?'REQUIRED_EVENT_NOT_PRICED':'NO_FRESH_DRAFTKINGS_PRICE'});
  }
 }
 const requiredCount=requirements.size;
 const coveredCount=satisfied.length;
 return {mode:'DRAFTKINGS_EXPECTED_VS_OBSERVED' as const,
  asOf:new Date(now).toISOString(),catalogProvided:requiredCount>0,
  requiredCount,coveredCount,missingCount:requiredCount-coveredCount,
  coveragePercent:requiredCount?100*coveredCount/requiredCount:null,
  coverageComplete:requiredCount>0&&coveredCount===requiredCount&&
   (rejected.INVALID_REQUIRED_MARKET||0)===0,
  missing,bySport:[...groupSummary.values()].sort((a,b)=>a.sport.localeCompare(b.sport)),
  observedMarketTypes:covered.size,independentUpstreamCounts:Object.fromEntries(
   [...upstreams].map(([k,v])=>[k,v.size])),
  rejected,releaseCertified:false,
  warning:'Expected catalog must be externally authenticated and complete. Quoted DraftKings prices via aggregators do not establish independent upstream ownership or authorized storage.'};
}
