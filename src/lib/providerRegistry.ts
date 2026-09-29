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
};

export function providerHealth(p:ProviderState){
 const error=Math.max(0,Math.min(1,p.errorRate??0));
 const latency=Math.max(0,p.latencyMs??0);
 const latencyScore=latency<=300?1:latency<=800?.8:latency<=1500?.55:.25;
 const score=Math.max(0,Math.min(1,(1-error)*.7+latencyScore*.3));
 return {score,status:score>=.85?'HEALTHY':score>=.65?'DEGRADED':'UNHEALTHY'};
}

export function chooseProvider(providers:ProviderState[],capability:ProviderCapability){
 return providers
  .filter(p=>p.enabled&&p.capabilities.includes(capability))
  .sort((a,b)=>{
   const aHealth=providerHealth(a).score;
   const bHealth=providerHealth(b).score;
   const healthA=aHealth*1000+a.priority*2-(a.latencyMs??500)*.2;
   const healthB=bHealth*1000+b.priority*2-(b.latencyMs??500)*.2;
   return healthB-healthA;
  })[0]||null;
}
