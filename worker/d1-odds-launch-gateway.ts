import {checkNetworkAuth} from '../src/lib/firstPartySportsNetwork';
import {inspectOddsSourceRegistry,type RegisteredSource} from '../src/lib/stage1-odds-source-registry-audit';
import type {D1Database} from './d1-observations';

const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
/**
 * Authenticated, read-only Stage 1 launch inventory. Unlike synthetic model
 * readiness flags this inspects the ACTUAL bound D1 registry and odds count.
 * No raw player/bookmaker data, secrets or authorization claims are returned.
 */
export async function d1OddsLaunchReadiness(
 request:Request,
 env:{CRON_SECRET?:unknown;EDGEFORCE_NETWORK_TOKEN_SHA256?:unknown;INTELLIGENCE_DB?:unknown}
):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 const owner=typeof env.EDGEFORCE_NETWORK_TOKEN_SHA256==='string'&&
  checkNetworkAuth(request.headers.get('authorization'),env.EDGEFORCE_NETWORK_TOKEN_SHA256);
 const cron=typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=24&&
  request.headers.get('authorization')==='Bearer '+env.CRON_SECRET;
 if(!owner&&!cron)return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')return json({ok:false,error:'D1_BINDING_MISSING'},503);
 try{
  const [registry,odds,fresh]=await Promise.all([
   db.prepare('SELECT source_id,upstream_id,source_type,enabled FROM intelligence_sources ORDER BY source_id LIMIT 1001').all<RegisteredSource>(),
   db.prepare("SELECT COUNT(*) AS count FROM intelligence_observations WHERE observation_kind='odds'").first<{count:number}>(),
   db.prepare(`SELECT COUNT(*) AS count FROM intelligence_observations AS o
    INNER JOIN intelligence_sources AS s ON s.source_id=o.source_id
      AND s.upstream_id=o.upstream_id AND s.enabled=1
      AND s.source_type='sportsbook-odds'
    WHERE o.observation_kind='odds' AND o.observed_at>=? AND o.observed_at<=?`)
    .bind(new Date(Date.now()-15*60*1000).toISOString(),new Date().toISOString())
    .first<{count:number}>()
  ]);
  if(registry.results.length>1000)return json({ok:false,error:'REGISTRY_QUERY_CAP_REACHED'},503);
  const count=Number(odds?.count);
  if(!Number.isSafeInteger(count)||count<0)return json({ok:false,error:'ODDS_COUNT_INVALID'},503);
  const freshCount=Number(fresh?.count);
  if(!Number.isSafeInteger(freshCount)||freshCount<0||freshCount>count)
   return json({ok:false,error:'FRESH_ODDS_COUNT_INVALID'},503);
  const audit=inspectOddsSourceRegistry({sources:registry.results,storedOddsRows:count});
  const {candidates,...safe}=audit;
  return json({ok:true,asOf:new Date().toISOString(),...safe,
   enabledSourceCandidates:candidates.length,
   freshRegisteredOddsRows:freshCount,
   ...(!freshCount?{freshnessBlocker:'NO_FRESH_ENABLED_SPORTSBOOK_SOURCE_QUOTES'}:{}),
   dataClassification:'REGISTERED_SOURCES_AND_STORED_COUNT_ONLY',
   authenticatedCollectionVerified:false,entitlementVerified:false,
   independentUpstreamOwnershipVerified:false,productionCertified:false});
 }catch{
  return json({ok:false,error:'D1_ODDS_LAUNCH_READ_FAILED'},503);
 }
}
