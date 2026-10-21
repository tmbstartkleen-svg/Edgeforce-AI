export type NetworkRole='owner'|'director'|'division'|'specialist';
export type NetworkDivision='executive'|'data'|'quant'|'player'|'live'|'verification'|'engineering';
export type NetworkMember={
 id:string;name:string;title:string;rank:NetworkRole;
 division:NetworkDivision;reportsTo:string|null;
 mission:string;capabilities:string[];
};
export const NETWORK_ORG:NetworkMember[]=[
 {id:'owner',name:'Founder',title:'Founder & Executive Chairman',rank:'owner',division:'executive',reportsTo:null,mission:'Owns strategy, deployment approvals, spending, and final decisions.',capabilities:['approve','reject','direct']},
 {id:'atlas',name:'ATLAS',title:'Chief Director, Sports Intelligence',rank:'director',division:'executive',reportsTo:'owner',mission:'Plan, delegate, challenge findings, reconcile evidence, and report to the Founder.',capabilities:['plan','delegate','review','ask-founder']},
 {id:'mercury',name:'MERCURY',title:'Director, Sports Data Network',rank:'division',division:'data',reportsTo:'atlas',mission:'Discover licensed sports and leagues, normalize feeds, measure completeness and source freshness.',capabilities:['coverage','odds','source-inventory']},
 {id:'vector',name:'VECTOR',title:'Director, Quantitative Research',rank:'division',division:'quant',reportsTo:'atlas',mission:'Evaluate independent probabilities, simulations, fair prices, and expected value.',capabilities:['model-evaluation','simulations','calibration']},
 {id:'pulse',name:'PULSE',title:'Director, Player Intelligence',rank:'division',division:'player',reportsTo:'atlas',mission:'Analyze player props with sourced availability, lineups, statistics, and distribution assumptions.',capabilities:['player-props','injuries','lineups']},
 {id:'flash',name:'FLASH',title:'Director, Live Markets',rank:'division',division:'live',reportsTo:'atlas',mission:'Investigate time-sensitive matched quotes, line moves and executable arbitrage limitations.',capabilities:['live-odds','arbitrage','latency']},
 {id:'sentinel',name:'SENTINEL',title:'Director, Verification & Risk',rank:'division',division:'verification',reportsTo:'atlas',mission:'Independently challenge conclusions, enforce source evidence, track settlements and calibration.',capabilities:['fact-check','source-quality','risk']},
 {id:'forge',name:'FORGE',title:'Director, Engineering & Operations',rank:'division',division:'engineering',reportsTo:'atlas',mission:'Maintain secure, resilient infrastructure, approved deployments and auditability.',capabilities:['reliability','deploy-gate','security']},
 {id:'scout',name:'SCOUT',title:'Sport and League Discovery Bot',rank:'specialist',division:'data',reportsTo:'mercury',mission:'Inventory sport, league, event and market coverage without assuming full DraftKings availability.',capabilities:['sport-discovery']},
 {id:'relay',name:'RELAY',title:'Licensed Feed Integration Bot',rank:'specialist',division:'data',reportsTo:'mercury',mission:'Normalize authorized upstream data, track entitlements and quotas.',capabilities:['provider-ingest']},
 {id:'odds',name:'ODDS',title:'Value Pricing Bot',rank:'specialist',division:'quant',reportsTo:'vector',mission:'Compare target-book prices and break-even probability against independent qualified estimates.',capabilities:['expected-roi','value-board']},
 {id:'monte',name:'MONTE',title:'Simulation Bot',rank:'specialist',division:'quant',reportsTo:'vector',mission:'Run reproducible simulations and disclose assumptions and uncertainty.',capabilities:['simulation']},
 {id:'props',name:'PROPS',title:'Player Market Research Bot',rank:'specialist',division:'player',reportsTo:'pulse',mission:'Map player statistics and recent usage to precise betting markets.',capabilities:['player-statistics']},
 {id:'medic',name:'MEDIC',title:'Injury and Lineup Verification Bot',rank:'specialist',division:'player',reportsTo:'pulse',mission:'Verify injury reports and starting lineups with timestamps.',capabilities:['injury-verification']},
 {id:'arb',name:'ARB',title:'Arbitrage Analysis Bot',rank:'specialist',division:'live',reportsTo:'flash',mission:'Check matched outcomes, timing, quote validity and limitations.',capabilities:['arbitrage-math']},
 {id:'radar',name:'RADAR',title:'Live Pricing and Movement Bot',rank:'specialist',division:'live',reportsTo:'flash',mission:'Observe legal licensed feeds for price movement and staleness.',capabilities:['line-movement']},
 {id:'audit',name:'AUDIT',title:'Source Integrity Bot',rank:'specialist',division:'verification',reportsTo:'sentinel',mission:'Find missing evidence, provider conflicts, leaks and calibration weaknesses.',capabilities:['audit']},
 {id:'ledger',name:'LEDGER',title:'Results and CLV Bot',rank:'specialist',division:'verification',reportsTo:'sentinel',mission:'Compare published forecasts with settled outcomes and closing prices.',capabilities:['settlement','clv']},
 {id:'watchtower',name:'WATCHTOWER',title:'Platform Reliability Bot',rank:'specialist',division:'engineering',reportsTo:'forge',mission:'Flag service failures, deployment risks and data incidents.',capabilities:['observability']}
];

export const DIRECTORS=NETWORK_ORG.filter(x=>x.rank==='division');
export const OWNER_APPROVAL_ACTIONS=['deploy','spend','purchase-data','activate-provider','publish-verified-pick','wager'] as const;
export function hierarchyHealthy(){
 const ids=new Set(NETWORK_ORG.map(x=>x.id));
 if(ids.size!==NETWORK_ORG.length)return false;
 if(NETWORK_ORG.filter(x=>x.rank==='owner').length!==1)return false;
 if(NETWORK_ORG.filter(x=>x.rank==='director').length!==1)return false;
 return NETWORK_ORG.every(x=>(x.rank==='owner'&&x.reportsTo===null)||(x.reportsTo!==null&&ids.has(x.reportsTo)));
}
