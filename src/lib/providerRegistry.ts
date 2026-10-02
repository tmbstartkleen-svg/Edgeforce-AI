export type ProviderCapability='ODDS'|'WEATHER'|'INJURIES'|'STATS'|'RESULTS'|'PREDICTION_MARKETS';

export type ProviderState={
 id:string;
 name:string;
 priority:number;
 capabilities:ProviderCapability[];
 enabled:boolean;
 lastSuccessAt?:string;
 lastFailureAt?:string;
 latencyMs?:number;
 errorRate?:number;
 freshnessScore?:number;
 qualityScore?:number;
 circuitState?:'CLOSED'|'OPEN'|'HALF_OPEN';
 quarantinedUntil?:string;
 consecutiveFailures?:number;
};

const clamp=(x:number)=>Math.max(0,Math.min(1,x));

export function providerHealth(p:ProviderState,now=Date.now()){
 const error=clamp(p.errorRate??0);
 const latency=Math.max(0,p.latencyMs??0);
 const latencyScore=latency<=300?1:latency<=800?.8:latency<=1500?.55:.25;
 const freshness=clamp(p.freshnessScore??.8);
 const quality=clamp(p.qualityScore??.8);
 const quarantineUntil=p.quarantinedUntil?new Date(p.quarantinedUntil).getTime():0;
 const quarantined=(p.circuitState==='OPEN'&&quarantineUntil>now);
 const raw=clamp((1-error)*.42+latencyScore*.18+freshness*.18+quality*.22);
 const score=quarantined?0:raw;
 const status=quarantined?'QUARANTINED':score>=.85?'HEALTHY':score>=.65?'DEGRADED':'UNHEALTHY';
 return {score,status,quarantined,quarantinedUntil:p.quarantinedUntil};
}

export function chooseProvider(providers:ProviderState[],capability:ProviderCapability,now=Date.now()){
 return providers
  .filter(p=>p.enabled&&p.capabilities.includes(capability)&&!providerHealth(p,now).quarantined)
  .sort((a,b)=>{
   const aHealth=providerHealth(a,now).score;
   const bHealth=providerHealth(b,now).score;
   const healthA=aHealth*1000+a.priority*2-(a.latencyMs??500)*.15;
   const healthB=bHealth*1000+b.priority*2-(b.latencyMs??500)*.15;
   return healthB-healthA;
  })[0]||null;
}
