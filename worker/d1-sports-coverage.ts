type D1={prepare(sql:string):{all():Promise<{results:Record<string,unknown>[]}>}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown};
export async function sportsCoverageEvidence(request:Request,env:Env):Promise<Response>{
 const headers={'Cache-Control':'no-store'};
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)
  return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers});
 const db=env.INTELLIGENCE_DB as D1|undefined;
 if(!db?.prepare)return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers});
 try{
  const sourceRows=await db.prepare(`SELECT source_id,upstream_id,source_type,enabled FROM intelligence_sources ORDER BY source_id LIMIT 100`).all();
  // Only registered, enabled and upstream-matched source rows count as verified.
  const totals=await db.prepare(`SELECT COUNT(*) AS total,COUNT(DISTINCT m.source_id) AS sources,
   MAX(m.source_observed_at) AS latest_source_observed_at
   FROM sports_market_snapshots m INNER JOIN intelligence_sources s
   ON s.source_id=m.source_id AND s.upstream_id=m.upstream_id AND s.enabled=1`).all();
  const perSport=await db.prepare(`SELECT m.sport AS sport,COUNT(*) AS observations,
   COUNT(DISTINCT m.source_id) AS providers,
   MAX(m.source_observed_at) AS latest_source_observed_at
   FROM sports_market_snapshots m INNER JOIN intelligence_sources s
   ON s.source_id=m.source_id AND s.upstream_id=m.upstream_id AND s.enabled=1
   GROUP BY m.sport ORDER BY observations DESC LIMIT 30`).all();
  const total=Number(totals.results[0]?.total??0);
  const last=String(totals.results[0]?.latest_source_observed_at??'');
  const latestMs=Date.parse(last);
  // A clock skew or source timestamp in the future must not count as fresh.
  const age=Number.isFinite(latestMs)?Math.round((Date.now()-latestMs)/60000):null;
  const active=sourceRows.results.filter(row=>row.enabled===1);
  const certified=total>0&&age!==null&&age>=0&&age<=15&&active.length>0;
  return Response.json({ok:true,store:'D1',kind:'SPORTS_COVERAGE_EVIDENCE',totalObservations:total,
   distinctObservedSources:Number(totals.results[0]?.sources??0),activeRegisteredSources:active.length,
   latestObservedAt:last||null,latestObservationAgeMinutes:age,perSport:perSport.results,
   freshObservationsPresent:certified,registeredSourceOnly:true,sourceIndependenceCertified:false,providerLicenseCertified:false,
   historicalNeonParityCertified:false,productionSportsDataReady:false},{headers});
 }catch{return Response.json({ok:false,reason:'SPORTS_COVERAGE_EVIDENCE_UNAVAILABLE'},{status:503,headers});}
}
