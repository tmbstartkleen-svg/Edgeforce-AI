/** Release gate: never equate schema/read-only deployment with market-ready beta. */
export function evaluateBetaReadiness(evidence={}){
 const gates=[
  ['d1Deployment',evidence.d1Deployment===true,'Certified live D1 worker deployment'],
  ['d1Persistence',evidence.d1Persistence===true,'Certified D1 persistence readback'],
  ['agentTaskSchema',evidence.agentTaskSchema===true,'Certified additive agent task schema'],
  ['liveCollectors',evidence.liveCollectors===true,'Approved collectors running with bounded scheduling'],
  ['sportsObservations',evidence.sportsObservations===true,'Genuine fresh timestamped sports records stored and read back'],
  ['nonSportsContracts',evidence.nonSportsContracts===true,'Genuine non-sports contracts separated and stored'],
  ['dataPreservation',evidence.dataPreservation===true,'Neon history export and reconciliation independently verified'],
  ['dashboard',evidence.dashboard===true,'Production dashboard integrates separate live sports and event-market workspaces'],
  ['providerCoverage',evidence.providerCoverage===true,'Actual licensed market catalog and provider coverage measured'],
  ['reliability',evidence.reliability===true,'Hosted runtime health and quota budgets certified']
 ].map(([id,passed,requirement])=>({id,passed,requirement}));
 return {ready:gates.every(x=>x.passed),status:gates.every(x=>x.passed)?'BETA_CERTIFIED':'NOT_BETA_READY',
  gates,missing:gates.filter(x=>!x.passed).map(x=>x.id),
  notice:'Missing evidence is a failed gate, not proof of passing or an excuse to invent market coverage.'};
}
