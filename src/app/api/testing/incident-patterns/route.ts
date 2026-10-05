import {buildIncidentPatternProfiles} from '@/lib/incidentPatternLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return Response.json({ok:false,error:'disabled'},{status:404});
 const now=new Date('2026-10-05T18:00:00Z');
 const rows:any[]=[
  {primaryCause:'AUTOMATION',severity:'WATCH',impactedComponents:['automation'],observedAt:'2026-09-10T12:00:00Z'},
  {primaryCause:'AUTOMATION',severity:'ACTION',impactedComponents:['automation','injury-feed'],observedAt:'2026-10-01T12:00:00Z'},
  {primaryCause:'AUTOMATION',severity:'ACTION',impactedComponents:['automation','injury-feed'],observedAt:'2026-10-03T12:00:00Z'},
  {primaryCause:'MARKET_FRESHNESS',severity:'WATCH',impactedComponents:['market-feed'],observedAt:'2026-09-20T12:00:00Z'}
 ];
 const profiles=buildIncidentPatternProfiles(rows,now);
 const top=profiles[0];
 return Response.json({
  ok:top?.cause==='AUTOMATION'&&top.recurrenceScore>profiles[1].recurrenceScore&&top.cofailureComponents.includes('injury-feed'),
  schemaVersion:'v76-incident-pattern-test-1',
  profiles
 });
}
