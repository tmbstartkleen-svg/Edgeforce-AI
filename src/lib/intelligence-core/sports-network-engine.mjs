import {SPORT_DOMAINS, SPECIALIST_AGENTS} from './specialist-network.mjs';

/** Source-governed specialist network. Planning and analysis only: no fetches, writes, or synthetic prices. */
export const NETWORK_LANES=Object.freeze([
 {kind:'SCHEDULES',cost:1,priority:75,maxAgeMs:86400000},
 {kind:'ODDS',cost:2,priority:100,maxAgeMs:1200000},
 {kind:'PLAYER_PROPS',cost:2,priority:98,maxAgeMs:1200000},
 {kind:'INJURIES',cost:1,priority:92,maxAgeMs:3600000},
 {kind:'LINEUPS',cost:1,priority:94,maxAgeMs:3600000},
 {kind:'PLAYER_STATS',cost:2,priority:85,maxAgeMs:86400000},
 {kind:'TEAM_STATS',cost:1,priority:80,maxAgeMs:86400000},
 {kind:'WEATHER',cost:1,priority:45,maxAgeMs:3600000},
 {kind:'RESULTS',cost:1,priority:90,maxAgeMs:86400000},
 {kind:'HISTORY',cost:3,priority:30,maxAgeMs:604800000},
]);
const laneMap=new Map(NETWORK_LANES.map(l=>[l.kind,l]));
const boundedInteger=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
const nonempty=(s)=>typeof s==='string'&&s.trim().length>0;

/** Each authorized source declares its actual upstream ownership and covered lanes/sports. */
export function planSportsNetwork({sources=[],sports=SPORT_DOMAINS,lanes=NETWORK_LANES.map(l=>l.kind),
 budgetCredits=0,maxJobs=20,now=Date.now(),lastCollected={},disabledSports=[]}={}){
 if(!Array.isArray(sources)||!Array.isArray(sports)||!Array.isArray(lanes)||
    !boundedInteger(budgetCredits,100000)||!boundedInteger(maxJobs,500)||!Number.isFinite(now))
  throw new TypeError('INVALID_NETWORK_PLAN');
 const disabled=new Set(disabledSports);
 const jobs=[],missing=[],rejected=[];let reservedCredits=0;
 for(const sport of [...new Set(sports)].slice(0,SPORT_DOMAINS.length)){
  if(!SPORT_DOMAINS.includes(sport)||disabled.has(sport))continue;
  for(const kind of [...new Set(lanes)].slice(0,NETWORK_LANES.length)){
   const lane=laneMap.get(kind);if(!lane)continue;
   const matches=sources.filter(s=>s&&s.enabled===true&&s.licenseApproved===true&&
    nonempty(s.sourceId)&&nonempty(s.upstreamId)&&Array.isArray(s.sports)&&s.sports.includes(sport)&&
    Array.isArray(s.lanes)&&s.lanes.includes(kind)&&boundedInteger(s.creditCost??lane.cost,10000)&&
    (s.creditCost??lane.cost)>0);
   if(!matches.length){missing.push({sport,lane:kind,reason:'NO_LICENSED_ENABLED_SOURCE'});continue;}
   const eligible=matches.filter(s=>{
    const ts=lastCollected[`${s.sourceId}:${sport}:${kind}`];
    return ts===undefined||(Number.isFinite(ts)&&now-ts>=lane.maxAgeMs);
   }).sort((a,b)=>(a.creditCost??lane.cost)-(b.creditCost??lane.cost)||String(a.sourceId).localeCompare(String(b.sourceId)));
   if(!eligible.length){rejected.push({sport,lane:kind,reason:'FRESH_ENOUGH_ALREADY'});continue;}
   const s=eligible[0],cost=s.creditCost??lane.cost;
   if(jobs.length>=maxJobs||cost+reservedCredits>budgetCredits){rejected.push({sport,lane:kind,reason:'BUDGET_OR_CAPACITY'});continue;}
   jobs.push({id:`${sport}:${kind}:${s.sourceId}`,sport,lane:kind,agentId:`sport-${sport.toLowerCase()}`,
    sourceId:s.sourceId,upstreamId:s.upstreamId,cost,priority:lane.priority,
    status:'PROPOSED_ONLY',requiresAuthorization:true,scheduledAt:new Date(now).toISOString()});
   reservedCredits+=cost;
  }
 }
 return {mode:'PLAN_ONLY',jobs,missing,rejected,budgetCredits,reservedCredits,remainingCredits:budgetCredits-reservedCredits,
  specialistRolesRegistered:SPECIALIST_AGENTS.length,executionStarted:false,networkRequests:0,
  note:'A registered persona is not a running crawler; execution requires certified adapters, credentials, and an approved scheduler.'};
}

/** Quote consensus eligibility requires independently identified upstream operators. */
export function auditMarketObservations(observations,{now=Date.now(),maxAgeMs=1200000,targetBook='DraftKings'}={}){
 if(!Array.isArray(observations)||!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0)
  throw new TypeError('INVALID_OBSERVATION_AUDIT');
 const valid=[],rejected=[];
 for(const q of observations.slice(0,5000)){
  const reason=!q||!nonempty(q.upstreamId)||!nonempty(q.providerId)||!nonempty(q.bookmaker)||
    !nonempty(q.eventId)||!nonempty(q.marketKey)||!nonempty(q.selectionKey)||
    !Number.isFinite(q.odds)||Math.abs(q.odds)<100||!Number.isFinite(q.observedAt)
    ?'INCOMPLETE_SOURCE_EVIDENCE'
    :q.observedAt>now+60000?'FUTURE_TIMESTAMP'
    :now-q.observedAt>maxAgeMs?'STALE_OBSERVATION'
    :null;
  if(reason)rejected.push({reason});else valid.push(q);
 }
 const byMarket=new Map();
 for(const q of valid){const k=[q.eventId,q.marketKey,q.selectionKey].join('|');
  if(!byMarket.has(k))byMarket.set(k,[]);byMarket.get(k).push(q);}
 const markets=[];
 for(const [marketId,quotes] of byMarket){
  const books=[...new Set(quotes.map(q=>q.bookmaker))];
  const upstreams=[...new Set(quotes.map(q=>q.upstreamId))];
  const target=quotes.filter(q=>q.bookmaker.toLowerCase()===targetBook.toLowerCase())
   .sort((a,b)=>b.observedAt-a.observedAt)[0];
  markets.push({marketId,bookmakers:books,independentUpstreamCount:upstreams.length,
   targetBookObserved:Boolean(target),targetOdds:target?.odds??null,
   crossUpstreamVerified:upstreams.length>=2,
   eligibleForTargetBookAnalysis:Boolean(target)&&upstreams.length>=2,
   note:upstreams.length<2?'MULTI_BOOK_AGGREGATOR_DOES_NOT_COUNT_AS_INDEPENDENT_UPSTREAM':null});
 }
 return {accepted:valid.length,rejected:rejected.length,rejectionReasons:rejected.reduce((a,r)=>(a[r.reason]=(a[r.reason]||0)+1,a),{}),markets,
  sourceAuthenticityCertified:false,simulationsRun:0,pricesInvented:0};
}

/** Value gate requires an independent, calibrated probability instead of the market implied value. */
export function evaluateVerifiedEdge({americanOdds,modelProbability,modelCalibrated=false,
 sourceAudited=false,independentUpstreams=0,targetBookObserved=false}={}){
 const eligible=Number.isFinite(americanOdds)&&Math.abs(americanOdds)>=100&&
  Number.isFinite(modelProbability)&&modelProbability>0&&modelProbability<1;
 if(!eligible)return {status:'REJECT',reason:'INVALID_ODDS_OR_PROBABILITY'};
 const decimal=americanOdds>0?1+americanOdds/100:1+100/(-americanOdds);
 const breakEvenProbability=1/decimal;
 const edgePercentagePoints=(modelProbability-breakEvenProbability)*100;
 const expectedRoi=(modelProbability*decimal-1)*100;
 const blockers=[];
 if(!sourceAudited)blockers.push('PROVIDER_PROVENANCE_UNVERIFIED');
 if(!targetBookObserved)blockers.push('TARGET_BOOK_PRICE_UNVERIFIED');
 if(independentUpstreams<2)blockers.push('INDEPENDENT_UPSTREAM_CONSENSUS_MISSING');
 if(!modelCalibrated)blockers.push('INDEPENDENT_MODEL_CALIBRATION_MISSING');
 if(expectedRoi<=0)blockers.push('NOT_POSITIVE_EXPECTED_VALUE');
 return {status:blockers.length?'NOT_ACTIONABLE':'CANDIDATE_FOR_FURTHER_REVIEW',blockers,
  breakEvenProbability,modelProbability,edgePercentagePoints,expectedRoi,
  simulationCountVerified:0,execution:'NONE'};
}
