import {nextCircuitTransition} from '@/lib/intelligenceReliability';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const required={label:'Injuries',required:true,state:'FAILED' as const};
 const first=nextCircuitTransition(undefined,required);
 const second=nextCircuitTransition({circuitState:first.circuitState,consecutiveFailures:first.consecutiveFailures,consecutiveHealthy:first.consecutiveHealthy},required);
 const recover1=nextCircuitTransition({circuitState:second.circuitState,consecutiveFailures:second.consecutiveFailures,consecutiveHealthy:second.consecutiveHealthy},{label:'Injuries',required:true,state:'HEALTHY' as const});
 const recover2=nextCircuitTransition({circuitState:recover1.circuitState,consecutiveFailures:recover1.consecutiveFailures,consecutiveHealthy:recover1.consecutiveHealthy},{label:'Injuries',required:true,state:'HEALTHY' as const});
 const optional1=nextCircuitTransition(undefined,{label:'Venue',required:false,state:'FAILED' as const});
 const optional2=nextCircuitTransition({circuitState:optional1.circuitState,consecutiveFailures:optional1.consecutiveFailures,consecutiveHealthy:optional1.consecutiveHealthy},{label:'Venue',required:false,state:'FAILED' as const});
 const optional3=nextCircuitTransition({circuitState:optional2.circuitState,consecutiveFailures:optional2.consecutiveFailures,consecutiveHealthy:optional2.consecutiveHealthy},{label:'Venue',required:false,state:'FAILED' as const});
 const ok=
  first.circuitState==='CLOSED'&&
  second.circuitState==='OPEN'&&
  recover1.circuitState==='HALF_OPEN'&&
  recover2.circuitState==='CLOSED'&&
  optional2.circuitState==='CLOSED'&&
  optional3.circuitState==='OPEN';
 return Response.json({ok,build:'V72',schemaVersion:'v72-reliability-1',required:{first,second,recover1,recover2},optional:{optional1,optional2,optional3}},{headers:{'Cache-Control':'no-store'}});
}
