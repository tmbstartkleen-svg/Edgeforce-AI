export function evaluateIntelligenceReadiness(x){
 const blockers:string[]=[];
 if(!x.schemaReady)blockers.push('MIGRATION_REQUIRED');
 if(x.approvedProviders<1)blockers.push('NO_APPROVED_PROVIDERS');
 if(x.observationCount<1)blockers.push('NO_PERSISTED_OBSERVATIONS');
 if(x.latestObservationMs===null||!Number.isFinite(x.latestObservationMs)||
    x.latestObservationMs>x.now+60000||x.now-x.latestObservationMs>900000)
  blockers.push('NO_FRESH_OBSERVATIONS');
 if(x.stuckRuns>0)blockers.push('EXPIRED_AGENT_LEASES');
 if(x.failedRuns>10)blockers.push('EXCESSIVE_AGENT_FAILURES');
 const runtimeHealthy=x.lastSuccessfulRunMs!==null&&Number.isFinite(x.lastSuccessfulRunMs)&&
   x.lastSuccessfulRunMs<=x.now+60000&&x.now-x.lastSuccessfulRunMs<=1800000;
 const activationAllowed=blockers.length===0;
 return {
  activationAllowed,
  runtimeHealthy:activationAllowed&&x.coreEnabled&&runtimeHealthy,
  mode:x.coreEnabled?'ENABLED':'DISABLED',
  mirrorEnabled:x.mirrorEnabled,
  blockers,
  note:'Readiness is evidence-based; live uptime and provider independence require separate verification'
 };
}
