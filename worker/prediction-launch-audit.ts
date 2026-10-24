/** EdgeForce production launch audit: read only, fail closed.
 * No odds API calls, schema mutations, external notifications or synthetic signals.
 */
type DB={prepare(sql:string):{first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;PREDICTION_CATALOG_ENABLED?:unknown;PREDICTION_ORDERBOOK_ENABLED?:unknown;PREDICTION_WATCH_WRITE_ENABLED?:unknown;D1_SPORTS_MARKET_ARCHIVE_ENABLED?:unknown};
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(x:unknown,status=200)=>Response.json(x,{status,headers});
const required=['intelligence_sources','sports_market_snapshots','specialist_tasks','prediction_arbitrage_watches','prediction_arbitrage_observations','prediction_arbitrage_alerts'];
const boundedNumber=(x:unknown)=>Math.max(0,Number(x)||0);
export async function predictionLaunchAudit(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24)return json({ok:false,error:'OWNER_AUTH_NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as DB|undefined;if(!db?.prepare)return json({ok:false,error:'D1_BINDING_MISSING'},503);
 try{
  const placeholders=required.map(()=>'?').join(',');
  const schema=await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`)
   .all<{name:string}>();
  // A missing table is a blocker; skip all dependent queries rather than returning misleading 0 counts.
  const existing=new Set((schema.results||[]).map(r=>r.name));
  const missing=required.filter(x=>!existing.has(x));
  const blockers:string[]=[];
  if(missing.length)blockers.push('D1_TABLES_MISSING');
  const flags={
   publicCatalog:env.PREDICTION_CATALOG_ENABLED==='true',
   selectedOrderbookReview:env.PREDICTION_ORDERBOOK_ENABLED==='true',
   watchPersistence:env.PREDICTION_WATCH_WRITE_ENABLED==='true',
   paidSportsbookArchiveWrites:env.D1_SPORTS_MARKET_ARCHIVE_ENABLED==='true'
  };
  if(!flags.publicCatalog)blockers.push('PUBLIC_MARKET_DISCOVERY_NOT_ACTIVATED');
  if(!flags.selectedOrderbookReview)blockers.push('ORDERBOOK_REVIEW_NOT_ACTIVATED');
  if(!flags.watchPersistence)blockers.push('WATCHLIST_WRITES_NOT_ACTIVATED');
  const counts:{watches:number;recordedObservations:number;deliveredAlerts:number;enabledOddsSources:number;archivedOdds:number}={
   watches:0,recordedObservations:0,deliveredAlerts:0,enabledOddsSources:0,archivedOdds:0
  };
  if(existing.has('prediction_arbitrage_watches'))counts.watches=boundedNumber((await db.prepare('SELECT COUNT(*) AS count FROM prediction_arbitrage_watches').first<{count:number}>())?.count);
  if(existing.has('prediction_arbitrage_observations'))counts.recordedObservations=boundedNumber((await db.prepare('SELECT COUNT(*) AS count FROM prediction_arbitrage_observations').first<{count:number}>())?.count);
  if(existing.has('prediction_arbitrage_alerts'))counts.deliveredAlerts=boundedNumber((await db.prepare("SELECT COUNT(*) AS count FROM prediction_arbitrage_alerts WHERE delivery_state != 'NOT_DISPATCHED'").first<{count:number}>())?.count);
  if(existing.has('intelligence_sources'))counts.enabledOddsSources=boundedNumber((await db.prepare("SELECT COUNT(*) AS count FROM intelligence_sources WHERE enabled=1 AND source_type='ODDS'").first<{count:number}>())?.count);
  if(existing.has('sports_market_snapshots'))counts.archivedOdds=boundedNumber((await db.prepare('SELECT COUNT(*) AS count FROM sports_market_snapshots').first<{count:number}>())?.count);
  if(!counts.recordedObservations)blockers.push('NO_RECORDED_PREDICTION_ORDERBOOK_OBSERVATIONS');
  if(!counts.enabledOddsSources)blockers.push('NO_APPROVED_ACTIVE_ODDS_SOURCES');
  if(!counts.archivedOdds)blockers.push('NO_ARCHIVED_SPORTSBOOK_QUOTES');
  // These are not inferable from source titles or order-book snapshots.
  blockers.push('CROSS_EXCHANGE_SETTLEMENT_RULES_NOT_CERTIFIED');
  blockers.push('EXCHANGE_FEE_AND_EXECUTABLE_FILL_NOT_CERTIFIED');
  blockers.push('IN_DASHBOARD_BACKGROUND_ALERT_DELIVERY_NOT_CERTIFIED');
  blockers.push('OUT_OF_SAMPLE_MODEL_VALUE_NOT_CERTIFIED');
  return json({ok:true,mode:'OWNER_READ_ONLY_LAUNCH_AUDIT',generatedAt:new Date().toISOString(),
   status:'NOT_CERTIFIED',launchCertified:false,marketDataCertified:false,executableArbitrageCertified:false,
   blockers,db:{binding:'INTELLIGENCE_DB',existingTables:[...existing],missingTables:missing},
   flags,counts,
   externalRequests:0,paidOddsApiCreditsSpent:0,ordersPlaced:0,writesPerformed:0,
   notes:['D1 counts reflect storage, not price freshness or exchange licensing.',
    'Manually recorded order-book gaps are not verified arbitrage.',
    'Independent hourly research monitoring is not proof of in-dashboard push delivery.',
    'No automated market scanning or alert channel is enabled by this endpoint.']});
 }catch{return json({ok:false,error:'READ_ONLY_LAUNCH_AUDIT_FAILED',launchCertified:false,writesPerformed:0},503)}
}
