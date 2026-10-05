import {assessMarketIntelligence,enrichMarketsWithUnifiedIntelligence} from '@/lib/unifiedIntelligence';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

const base={
 id:'evt-1',sport:'NBA',league:'NBA',event:'Away @ Home',selection:'Player A over 24.5 points',market:'player_points',
 startTime:'2026-10-06T00:00:00Z',home:'Home',away:'Away',odds:-110,marketProb:.524,modelProb:.61,confidence:.82,sourceAgeMin:2,period:'PM',
 sportFeatures:{scheduleFatigueConfidence:.88,venueWeatherConfidence:.96,marketMovementConfidence:.72},
 playerContext:{name:'Player A',projection:27,stdDev:5,availability:1,starter:true},
 contextQuality:{score:.88,coverage:.86,criticalCoverage:.90,recommendationReady:true,requiredFields:[],missingFields:[],sourceScore:.9,provenanceScore:.9},
 contextProvenance:[
  {source:'injuries',providerId:'injuries',field:'playerAvailability',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'LIVE'},
  {source:'player-history-db',providerId:'edgeforce',field:'history',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'},
  {source:'player-feature-frame',providerId:'edgeforce',field:'frame',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'},
  {source:'player-calibration',providerId:'edgeforce',field:'calibration',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'},
  {source:'opponent-matchup',providerId:'edgeforce',field:'matchup',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'},
  {source:'lineup-redistribution',providerId:'edgeforce',field:'role',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'},
  {source:'starting-lineup',providerId:'edgeforce',field:'starter',observedAt:'2026-10-05T16:00:00Z',confidence:.9,status:'CACHED'}
 ]
} as unknown as Market;

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const healthy=assessMarketIntelligence(base);
 const thin=assessMarketIntelligence({
  ...base,sourceAgeMin:45,
  contextQuality:{...base.contextQuality!,score:.35,criticalCoverage:.30,recommendationReady:false},
  contextProvenance:[],sportFeatures:{}
 } as Market);
 const enriched=enrichMarketsWithUnifiedIntelligence([base]);
 const ok=healthy.ready&&healthy.score>.70&&healthy.playerStack>.80&&!thin.ready&&thin.score<healthy.score&&Number(enriched.markets[0].sportFeatures?.intelligenceStackReady)===1;
 return Response.json({ok,build:'V71',schemaVersion:'v71-unified-intelligence-1',healthy,thin,diagnostics:enriched.diagnostics},{headers:{'Cache-Control':'no-store'}});
}
