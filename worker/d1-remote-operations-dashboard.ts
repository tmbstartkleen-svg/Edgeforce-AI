/** Cloudflare-native remote dashboard over authorized first-party D1 observations.
 * No provider calls, writes, credentials or nominal bookmaker independence claims.
 */
type Db={prepare(sql:string):{bind(...x:unknown[]):{all<T>():Promise<{results:T[]}>};first<T>():Promise<T|null>}};
type Env={CRON_SECRET?:unknown;INTELLIGENCE_DB?:unknown;D1_SPORTS_MARKET_ARCHIVE_ENABLED?:unknown};
const hdr={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:hdr});
const validIso=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const nonnegative=(x:unknown)=>Math.max(0,Number(x)||0);
export async function d1RemoteOperationsDashboard(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{...hdr,Allow:'GET'}});
 const secret=env.CRON_SECRET;
 if(typeof secret!=='string'||secret.length<24)return json({ok:false,error:'NOT_CONFIGURED'},503);
 if(request.headers.get('authorization')!=='Bearer '+secret)return json({ok:false,error:'UNAUTHORIZED'},401);
 const db=env.INTELLIGENCE_DB as Db|undefined;
 if(!db||typeof db.prepare!=='function')return json({ok:false,error:'D1_BINDING_MISSING'},503);
 const now=Date.now(),cutoff=new Date(now-20*60_000).toISOString();
 try{
  const [inventory,marketRows,agentRows,approved]=await Promise.all([
   db.prepare(`SELECT COUNT(*) AS total,MAX(source_observed_at) AS most_recent_at
      FROM sports_market_snapshots`).first<{total:number;most_recent_at:string|null}>(),
   db.prepare(`SELECT sport,bookmaker,source_id AS provider,upstream_id,source_observed_at,
      ingested_at, COUNT(*) AS quote_count
     FROM sports_market_snapshots
     WHERE source_observed_at>=? AND source_observed_at<=?
     GROUP BY sport,bookmaker,source_id,upstream_id,source_observed_at,ingested_at
     ORDER BY source_observed_at DESC LIMIT 1000`).bind(cutoff,new Date(now+30000).toISOString()).all<{
      sport:string;bookmaker:string;provider:string;upstream_id:string;source_observed_at:string;ingested_at:string;quote_count:number
     }>(),
   db.prepare(`SELECT agent_id,task_state AS status,COUNT(*) AS count,
      MAX(updated_at) AS most_recent_at FROM specialist_tasks
      GROUP BY agent_id,task_state ORDER BY agent_id,task_state LIMIT 100`).all<{
       agent_id:string;status:string;count:number;most_recent_at:string
      }>(),
   db.prepare(`SELECT source_id,upstream_id FROM intelligence_sources
      WHERE enabled=1 AND source_type='ODDS' LIMIT 200`).all<{source_id:string;upstream_id:string}>()
  ]);
  const allowed=new Map((approved.results||[]).map(x=>[x.source_id,x.upstream_id]));
  const rows=(marketRows.results||[]).filter(x=>validIso(x.source_observed_at)&&
   Date.parse(x.source_observed_at)>=now-20*60_000&&Date.parse(x.source_observed_at)<=now+30000&&
   allowed.get(x.provider)===x.upstream_id);
  const summary={total:nonnegative(inventory?.total),recent:rows.reduce((a,x)=>a+nonnegative(x.quote_count),0),
   draftKingsRecent:rows.filter(x=>x.bookmaker.toLowerCase()==='draftkings').reduce((a,x)=>a+nonnegative(x.quote_count),0),
   independentProvidersRecent:new Set(rows.map(x=>x.upstream_id)).size,mostRecentAt:inventory?.most_recent_at||null};
  const blockers:string[]=[];
  if(!summary.recent)blockers.push('NO_FRESH_APPROVED_D1_ODDS');
  if(!summary.draftKingsRecent)blockers.push('NO_FRESH_DRAFTKINGS_LABELLED_QUOTES');
  if(summary.independentProvidersRecent<2)blockers.push('LESS_THAN_TWO_APPROVED_UPSTREAM_IDENTITIES');
  const combined=new Map<string,{sport:string;bookmaker:string;provider:string;quote_count:number;most_recent_at:string}>();
  for(const r of rows){const key=[r.sport,r.bookmaker,r.provider].join('|');const before=combined.get(key);
   combined.set(key,{sport:r.sport,bookmaker:r.bookmaker,provider:r.provider,
    quote_count:(before?.quote_count||0)+nonnegative(r.quote_count),
    most_recent_at:before&&Date.parse(before.most_recent_at)>Date.parse(r.source_observed_at)?before.most_recent_at:r.source_observed_at});
  }
  const marketSummary=[...combined.values()].sort((a,b)=>b.quote_count-a.quote_count).slice(0,100);
  const providers=(approved.results||[]).map(x=>({id:x.source_id,name:x.source_id,bookmaker:'Source-authorized',enabled:true,credentialConfigured:null}));
  return json({ok:true,status:blockers.length?'DEGRADED':'UNVERIFIED_SOURCE_AUTHENTICITY',blockers,
   generatedAt:new Date(now).toISOString(),build:'CLOUDFLARE_D1',dataStore:'D1_INTELLIGENCE_DB',
   summary,marketSummary,agentSummary:(agentRows.results||[]).map(x=>({...x,count:nonnegative(x.count)})),providers,
   independentUpstreamsCertified:false,fullDraftKingsCatalogCertified:false,modelsCalibratedCertified:false,
   readOnly:true,oddsApiCalls:0,sampleLimited:marketRows.results.length===1000,
   notes:['D1 counts only approved source IDs whose declared upstream matches archived quotes.',
    'Source-observed time determines freshness, not database arrival.',
    'Multiple upstream labels are not externally verified ownership or executable prices.',
    'Agent task statuses come from D1 ledger; no synthetic running agent status is shown.']});
 }catch{return json({ok:false,error:'D1_DASHBOARD_QUERY_FAILED',readOnly:true,oddsApiCalls:0},503)}
}
