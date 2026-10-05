import {attributeOperationalIncident} from '@/lib/incidentAttribution';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const base:any={
  overall:'CRITICAL',score:.4,summary:{healthy:2,degraded:0,critical:2,unknown:0,total:4},
  incidents:{action:0,watch:0,total:0},database:{configured:true,latencyMs:120,error:null},
  freshness:{latestMarketAgeMin:120,latestConsensusAgeMin:10,latestModelRunAgeMin:20,latestAutomationAgeMin:30},
  automation:{},reliability:{},checks:[
   {id:'database',state:'HEALTHY',reason:'ok'},
   {id:'market-freshness',state:'CRITICAL',reason:'market feed 120 minutes old'},
   {id:'consensus-freshness',state:'HEALTHY',reason:'ok'},
   {id:'model-freshness',state:'HEALTHY',reason:'ok'},
   {id:'automation-health',state:'HEALTHY',reason:'ok'},
   {id:'reliability-mode',state:'HEALTHY',reason:'NORMAL'},
   {id:'incidents',state:'HEALTHY',reason:'0 incidents'}
  ]
 };
 const a=attributeOperationalIncident(base);
 return Response.json({ok:a.primaryCause==='MARKET_FRESHNESS'&&a.severity==='ACTION',schemaVersion:'v75-incident-attribution-test-1',attribution:a});
}
