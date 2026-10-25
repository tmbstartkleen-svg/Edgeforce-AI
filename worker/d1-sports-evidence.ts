/** Read-only bridge to the isolated sports network. Never invokes a collector. */
import {createHash} from 'node:crypto';
import {GLOBAL_SPORT_REGISTRY} from '../src/lib/sportRegistry';
import {normalizeD1OpportunityQuotes} from './d1-sportsbook-opportunity-review';
import {buildSportsCoverage,monteCarloForQuote} from '../src/lib/intelligence-core/sports-evidence.mjs';
type Row=Record<string,unknown>;
type DB={prepare(sql:string):{bind(...args:unknown[]):{all<T>():Promise<{results:T[]}>}}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;SPORTS_NETWORK_DB?:unknown};
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function d1SportsEvidence(request:Request,env:Env){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...headers,Allow:'GET'}});
 if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<24)return json({ok:false,error:'AUTH_NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as DB,network=env.SPORTS_NETWORK_DB as DB;
 if(!db?.prepare||!network?.prepare)return json({ok:false,error:'SPORTS_EVIDENCE_BINDING_MISSING'},503);
 const query=(store:DB,sql:string,...args:unknown[])=>store.prepare(sql).bind(...args).all<Row>();
 try{
  const now=Date.now(),cutoff=new Date(now-1200000).toISOString(),end=new Date(now).toISOString();
  const [scores,stored,sources,runs]=await Promise.all([
   query(network,`SELECT o.source_id,COUNT(*) AS total,MAX(o.observed_at) AS latest
    FROM intelligence_observations o JOIN intelligence_sources s ON s.source_id=o.source_id AND s.upstream_id=o.upstream_id
    WHERE s.enabled=1 AND s.source_type='scoreboard' AND o.observation_kind='score'
    GROUP BY o.source_id ORDER BY o.source_id LIMIT 201`),
   query(db,`SELECT * FROM sports_market_snapshots WHERE source_observed_at>=? AND source_observed_at<=? ORDER BY source_observed_at DESC LIMIT 501`,cutoff,end),
   query(db,`SELECT source_id,upstream_id FROM intelligence_sources WHERE enabled=1 AND source_type='ODDS' LIMIT 201`),
   query(db,`SELECT event_id,market_key,selection_key,model_version,run_count,created_at,feature_snapshot FROM model_runs WHERE created_at>=? AND created_at<=? ORDER BY created_at DESC,id DESC LIMIT 501`,cutoff,end)
  ]);
  // Evidence hashes must exist under enabled, matching source identities. No raw payload leaves this endpoint.
  const inputs=runs.results.length?await query(network,`SELECT o.source_id,o.upstream_id,o.event_id,o.payload_hash,o.observed_at
   FROM intelligence_observations o JOIN intelligence_sources s ON s.source_id=o.source_id AND s.upstream_id=o.upstream_id
   WHERE s.enabled=1 AND o.observation_kind IN ('score','result','player-stat','injury','lineup','weather') AND o.observed_at>=? AND o.observed_at<=?
   ORDER BY o.observed_at DESC LIMIT 501`,new Date(now-86400000).toISOString(),end):{results:[]};
  const approved=sources.results.slice(0,200) as {source_id:string;upstream_id:string}[];
  type Archive=Parameters<typeof normalizeD1OpportunityQuotes>[0][number];
  const rows=stored.results.slice(0,500).filter(r=>{
   if(typeof r.raw_json!=='string'||createHash('sha256').update(r.raw_json).digest('hex')!==r.payload_sha256)return false;
   if(normalizeD1OpportunityQuotes([r as Archive],approved,now).acceptedQuotes!==1)return false;
   const raw=JSON.parse(r.raw_json);
   return [['sport','sport'],['league','league'],['home_team','home'],['away_team','away'],['start_time','startTime']].every(([storedKey,rawKey])=>typeof r[storedKey]==='string'&&String(r[storedKey]).trim()&&r[storedKey]===raw[rawKey]);
  }).map(r=>({
   sport:r.sport,league:r.league,event:`${r.away_team} at ${r.home_team}`,market:r.market_key,selection:r.selection_key,bookmaker:r.bookmaker,
   odds:r.american_odds,sourceId:r.source_id,upstreamId:r.upstream_id,observedAt:r.source_observed_at,payloadHash:r.payload_sha256,
   monteCarlo:monteCarloForQuote(r,runs.results.slice(0,500),inputs.results.slice(0,500),now)
  }));
  return json({ok:true,generatedAt:end,coverage:buildSportsCoverage(GLOBAL_SPORT_REGISTRY,scores.results.slice(0,200),now),rows,
   approvedOddsSources:approved.length,sampleLimited:stored.results.length>500||scores.results.length>200||sources.results.length>200||runs.results.length>500||inputs.results.length>500,
   completeCoverageCertified:false,sourceOwnershipCertified:false,modelCalibrationCertified:false,
   readOnly:true,externalRequests:0,oddsApiCreditsSpent:0});
 }catch{return json({ok:false,error:'SPORTS_EVIDENCE_UNAVAILABLE'},503)}
}
