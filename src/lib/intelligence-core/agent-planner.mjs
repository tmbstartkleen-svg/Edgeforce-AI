/**
 * EdgeForce Intelligence Core: bounded, deterministic scheduler policy.
 * Planning only: adapters perform authorized collection and durable writes.
 * No hidden scraping, no unsupported claims of provider independence.
 */
export const AGENTS = Object.freeze([
  {id:'live-games',lane:'realtime',activeMs:15000,idleMs:300000,cost:1,priority:100},
  {id:'sportsbook-odds',lane:'realtime',activeMs:30000,idleMs:300000,cost:2,priority:95},
  {id:'prediction-markets',lane:'market',activeMs:60000,idleMs:600000,cost:2,priority:85},
  {id:'player-stats',lane:'player',activeMs:120000,idleMs:900000,cost:2,priority:80},
  {id:'injuries-lineups',lane:'player',activeMs:180000,idleMs:900000,cost:2,priority:90},
  {id:'weather-venue',lane:'context',activeMs:900000,idleMs:3600000,cost:1,priority:55},
  {id:'history-backfill',lane:'batch',activeMs:86400000,idleMs:86400000,cost:5,priority:20},
  {id:'simulation',lane:'analytics',activeMs:30000,idleMs:900000,cost:3,priority:92},
  {id:'settlement-learning',lane:'analytics',activeMs:300000,idleMs:900000,cost:2,priority:75},
  {id:'data-quality',lane:'governance',activeMs:60000,idleMs:300000,cost:1,priority:98},
]);

/** Returns a feasible bounded plan without performing network requests. */
export function planAgentRuns({
  now=Date.now(), activeEvent=false, availableBudget=12, maxTasks=4,
  lastRuns={}, disabled=[], cooldowns={}, circuitOpen=[], supported=[],
}={}) {
  if (!Number.isFinite(now) || availableBudget<0 || maxTasks<0) throw new TypeError('Invalid scheduling inputs');
  const deny=new Set([...disabled,...circuitOpen]);
  const supportedSet=new Set(supported);
  const candidates=AGENTS.filter(a=>{
    if(deny.has(a.id))return false;
    if(supportedSet.size && !supportedSet.has(a.id))return false;
    if((cooldowns[a.id]??0)>now)return false;
    const last=lastRuns[a.id];
    return last==null || (Number.isFinite(last) && now-last >= (activeEvent?a.activeMs:a.idleMs));
  }).sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
  const tasks=[];let remaining=Math.floor(availableBudget);
  for(const agent of candidates){
    if(tasks.length>=maxTasks)break;
    if(remaining<agent.cost)continue;
    tasks.push({agentId:agent.id,lane:agent.lane,budgetUnits:agent.cost,scheduledAt:now});
    remaining-=agent.cost;
  }
  return {tasks,remainingBudget:remaining,skipped:candidates.length-tasks.length};
}

/** Strictly separate model-derived estimates from verified observations. */
export function normalizeObservation(input,now=Date.now()) {
  if(!input || typeof input!=='object')throw new TypeError('Observation required');
  const {provider,upstreamId,eventId,marketId,observedAt,kind,value}=input;
  if(!provider || !upstreamId || !eventId || !kind || !Number.isFinite(observedAt) || observedAt>now+60000)
    throw new TypeError('Incomplete or future-dated observation');
  if(!['score','odds','injury','lineup','player-stat','weather','prediction-market','result'].includes(kind))
    throw new TypeError('Unsupported observation type');
  return {provider:String(provider),upstreamId:String(upstreamId),eventId:String(eventId),
    marketId:marketId==null?null:String(marketId),kind,observedAt,
    ingestedAt:now,value,sourceClass:'EXTERNAL_OBSERVATION'};
}

export function classifyFreshness({observedAt,now=Date.now(),maxAgeMs=60000}){
  if(!Number.isFinite(observedAt) || observedAt>now+60000)return 'INVALID';
  return now-observedAt>maxAgeMs?'STALE':'FRESH';
}

/** Count independent upstream identities, not bookmaker labels inside aggregators. */
export function sourceCoverage(observations=[]){
  const identities=new Set(observations.filter(o=>o&&o.upstreamId).map(o=>o.upstreamId));
  return {independentUpstreams:identities.size,crossProviderVerified:identities.size>=2};
}
