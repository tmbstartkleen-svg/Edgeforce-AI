/**
 * EdgeForce specialist personas are scoped software work roles, not autonomous
 * background processes. Execution requires a separately authenticated scheduler,
 * verified sources, resource budgets and persistence certification.
 */
export const SPORT_DOMAINS=Object.freeze([
 'NFL','NCAAF','FCS','NBA','NCAAB','WNBA','MLB','NHL','SOCCER',
 'TENNIS','TABLE_TENNIS','GOLF','UFC_MMA','BOXING','NASCAR','FORMULA_1',
 'ESPORTS','CRICKET','RUGBY','AFL','LACROSSE','VOLLEYBALL','HANDBALL',
 'DARTS','BADMINTON','CYCLING','OLYMPICS','OTHER_SPORTS'
]);
export const NON_SPORTS_MARKETS=Object.freeze([
 'POLITICS','ECONOMICS','FINANCE','CRYPTO','WEATHER','CLIMATE',
 'TECHNOLOGY','CULTURE','ENTERTAINMENT','SCIENCE','GEOPOLITICS','OTHER_EVENTS'
]);
const sportAgents=SPORT_DOMAINS.map(sport=>Object.freeze({
 id:`sport-${sport.toLowerCase()}`,division:'SPORTS',role:'SPORT_ANALYST',
 sport,mission:'Track sanctioned source-dated schedules, rosters, injuries, stats, markets, simulations and outcomes',
 permissions:['READ_APPROVED_SOURCES','PROPOSE_OBSERVATIONS'],
 execution:'DISABLED_UNTIL_CERTIFIED'
}));
const predictions=NON_SPORTS_MARKETS.map(category=>Object.freeze({
 id:`prediction-${category.toLowerCase()}`,division:'PREDICTION_MARKETS',
 role:'EVENT_MARKET_ANALYST',category,
 mission:'Track sourced event contracts, resolution rules, probability markets, settlement and news evidence separately from sports',
 permissions:['READ_APPROVED_SOURCES','PROPOSE_OBSERVATIONS'],
 execution:'DISABLED_UNTIL_CERTIFIED'
}));
const specialists=[
 ['sports-modeling','SIMULATION_RESEARCH','Evaluate time-split model calibration, sport-specific backtests, uncertainty and player props'],
 ['market-comparison','MARKET_INTELLIGENCE','Compare independent authorized upstream market quotes with event/market provenance'],
 ['data-archive','HISTORICAL_DATA_STEWARD','Preserve historical source evidence and implement verified non-destructive migration'],
 ['software-engineering','SOFTWARE_ENGINEER','Implement code changes through reviewed, tested GitHub pull requests'],
 ['interface-design','PRODUCT_DESIGN','Maintain accessible distinct sports and non-sports views with readable responsive layouts'],
 ['source-quality','DATA_QUALITY','Reject stale, unsourced, duplicated and miscategorized observations'],
 ['ops-reliability','RELIABILITY_ENGINEER','Track D1 quotas, Worker CPU, fetch rates, outages and release health'],
 ['prediction-modeling','EVENT_MODELING','Backtest non-sports market forecasts against resolved contracts and maintain calibration'],
 ['compliance','SOURCE_LICENSE_REVIEW','Validate API permissions, licensing and market restrictions']
].map(([id,role,mission])=>Object.freeze({id,division:'PLATFORM',role,mission,
 permissions:['READ_METADATA','PROPOSE_CHANGES'],execution:'DISABLED_UNTIL_CERTIFIED'}));
export const SPECIALIST_AGENTS=Object.freeze([...sportAgents,...predictions,...specialists]);
export function routeSpecialistTask({division,sport,category}={}){
 if(division==='SPORTS' && sport) return sportAgents.find(a=>a.sport===sport)||null;
 if(division==='PREDICTION_MARKETS' && category) return predictions.find(a=>a.category===category)||null;
 return null;
}
export function specialistNetworkManifest(){
 return {version:1,activation:'DISABLED_UNTIL_CERTIFIED',agents:SPECIALIST_AGENTS,
  sportCoverage:'CONFIGURED_TAXONOMY_NOT_PROVEN_PROVIDER_COVERAGE',
  dataPolicy:'APPEND_ONLY_NO_AUTOMATIC_LEGACY_DELETION',
  separation:'NON_SPORTS_PREDICTION_MARKETS_DISTINCT_FROM_SPORTS'};
}
