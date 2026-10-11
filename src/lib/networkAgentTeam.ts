import {randomUUID} from 'node:crypto';
import {db} from '@/lib/db';
import {ESPN_SCOREBOARD_FEEDS} from '@/lib/sportRegistry';
import {easternDay,loadSchedule} from '@/lib/gameSchedule';

export const NETWORK_AGENT_IDS=[
 'market-watch','score-watch','injury-watch','player-watch',
 'forecast-audit','book-comparison','score-scout'
] as const;
export type NetworkAgentId=(typeof NETWORK_AGENT_IDS)[number];
type AgentStatus='EVIDENCE_FOUND'|'NO_RECENT_EVIDENCE'|'NO_LICENSE'|'ERROR';
export type AgentEvidence={
 status:AgentStatus;sourceRole:'STORED_FEED_DERIVED'|'AUTHORIZED_EXTERNAL_SCORE';
 sources:string[];rowCount:number;
 facts:Record<string,unknown>;
};
export function normalizeAgentSourceIds(ids:string[]):string[]{
 return [...new Set(ids.filter(x=>/^[A-Za-z0-9._-]{2,64}$/.test(x)))].slice(0,15);
}
export function safeAgeMinutes(value:unknown,now=Date.now()):number|null{
 if(!value)return null;
 const at=new Date(value as string).getTime();
 if(!Number.isFinite(at)||at>now+60000)return null;
 return Math.round(Math.max(0,(now-at)/60000));
}
function evidence(status:AgentStatus,rows:number,facts:Record<string,unknown>,sources:string[],role:AgentEvidence['sourceRole']='STORED_FEED_DERIVED'):AgentEvidence{
 return {status,sourceRole:role,rowCount:Math.min(500,Math.max(0,rows)),facts,
  sources:normalizeAgentSourceIds(sources)};
}
type MarketRow={sport:string;provider:string;bookmaker:string;market:string;pulledAt:Date|string;sourceTimestamp:string|null};
type ScoreRow={sport:string;source:string;scheduledAt:Date|string;collectedAt:Date|string};
type InjuryRow={provider:string|null;rowCount:number;observedAt:Date|string;expiresAt:Date|string};
type PlayerRow={sport:string;provider:string|null;importedAt:Date|string};
type ForecastRow={sport:string;model:string;createdAt:Date|string};
type ConsensusRow={sport:string;provider:string;bookmaker:string;eventId:string;market:string;selection:string;pulledAt:Date|string};
const packBySport=(rows:{sport:string}[])=>{
 const counts=new Map<string,number>();
 for(const row of rows)counts.set(row.sport,(counts.get(row.sport)||0)+1);
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([sport,n])=>({sport,records:n}));
};
export async function collectNetworkAgent(id:NetworkAgentId,now=Date.now()):Promise<AgentEvidence>{
 const sql=db();
 if(!sql)throw new Error('NETWORK_AGENT_DATABASE_UNAVAILABLE');
 if(id==='market-watch'){
  const rows=await sql<MarketRow[]>`
   select e.sport,ms.provider,ms.bookmaker,ms.market_key as market,
    ms.pulled_at as "pulledAt",nullif(ms.raw->>'sourceTimestamp','') as "sourceTimestamp"
   from (select event_id,provider,bookmaker,market_key,pulled_at,raw
    from market_snapshots order by id desc limit 240) ms
   join events e on e.id=ms.event_id`;
  const recent=rows.filter(x=>{
   const pulled=safeAgeMinutes(x.pulledAt,now),src=safeAgeMinutes(x.sourceTimestamp,now);
   return pulled!==null&&pulled<=10&&src!==null&&src<=10;
  });
  return evidence(recent.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   recentVerifiedTimestamps:recent.length,bookmakers:[...new Set(recent.map(x=>x.bookmaker))].slice(0,12),
   sourceProviders:normalizeAgentSourceIds(recent.map(x=>x.provider)),
   sports:packBySport(rows),onlyHistoricalPriceObservations:true,executableQuotes:false
  },recent.map(x=>x.provider));
 }
 if(id==='score-watch'){
  const rows=await sql<ScoreRow[]>`
   select sport,source,scheduled_at as "scheduledAt",collected_at as "collectedAt"
   from public.edgeforce_sports_outcomes_v209 order by id desc limit 180`;
  const recent=rows.filter(x=>(safeAgeMinutes(x.collectedAt,now)??Infinity)<=1440);
  return evidence(recent.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   finalScoreRevisionsObservedLast24h:recent.length,sports:packBySport(rows),
   sourceDeclaredFinalsOnly:true,officialResultsIndependentlyCertified:false
  },rows.map(x=>x.source));
 }
 if(id==='injury-watch'){
  const rows=await sql<InjuryRow[]>`
   select provider_id as provider,row_count as "rowCount",observed_at as "observedAt",
    expires_at as "expiresAt"
   from injury_context_snapshots order by observed_at desc limit 120`;
  const fresh=rows.filter(x=>{
   const age=safeAgeMinutes(x.observedAt,now);
   return age!==null&&age<=60&&new Date(x.expiresAt).getTime()>now;
  });
  return evidence(fresh.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   freshSnapshots:fresh.length,latestSnapshotAgeMinutes:safeAgeMinutes(rows[0]?.observedAt,now),
   availableContextRows:fresh.reduce((sum,x)=>sum+Math.max(0,Number(x.rowCount)||0),0),
   warning:'Injury status is source-provided context; do not infer medical diagnosis or availability without timestamped updates.'
  },rows.map(x=>x.provider||'').filter(Boolean));
 }
 if(id==='player-watch'){
  const rows=await sql<PlayerRow[]>`
   select e.sport,ps.source as provider,ps.imported_at as "importedAt"
   from (select event_id,source,imported_at from player_game_stats
    order by imported_at desc limit 180) ps
   join events e on e.id=ps.event_id`;
  const recent=rows.filter(x=>(safeAgeMinutes(x.importedAt,now)??Infinity)<=1440);
  return evidence(recent.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   playerRecordsImportedLast24h:recent.length,sports:packBySport(rows),
   historicalStatsNotLivePlayerTracking:true
  },rows.map(x=>x.provider||'').filter(Boolean));
 }
 if(id==='forecast-audit'){
  const rows=await sql<ForecastRow[]>`
   select e.sport,mr.model_version as model,mr.created_at as "createdAt"
   from (select event_id,model_version,created_at from model_runs
    order by id desc limit 180) mr
   join events e on e.id=mr.event_id`;
  const recent=rows.filter(x=>(safeAgeMinutes(x.createdAt,now)??Infinity)<=1440);
  return evidence(recent.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   modelRecordsLast24h:recent.length,sports:packBySport(rows),
   uniqueModelVersions:[...new Set(recent.map(x=>x.model))].slice(0,12),
   calibrationAndOutOfSampleAuditRequired:true,forecastsAreNotSettledOutcomes:true
  },['EDGEFORCE_MODEL']);
 }
 if(id==='book-comparison'){
  const rows=await sql<ConsensusRow[]>`
   select e.sport,ms.provider,ms.bookmaker,ms.event_id as "eventId",
    ms.market_key as market,ms.selection_key as selection,ms.pulled_at as "pulledAt"
   from (select event_id,provider,bookmaker,market_key,selection_key,pulled_at
    from market_snapshots order by id desc limit 240) ms
   join events e on e.id=ms.event_id`;
  const fresh=rows.filter(x=>(safeAgeMinutes(x.pulledAt,now)??Infinity)<=10);
  const groups=new Map<string,{books:Set<string>;upstreams:Set<string>}>();
  for(const row of fresh){
   const key=[row.eventId,row.market,row.selection].join('|');
   const g=groups.get(key)||{books:new Set<string>(),upstreams:new Set<string>()};
   g.books.add(row.bookmaker);g.upstreams.add(row.provider);groups.set(key,g);
  }
  return evidence(fresh.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',rows.length,{
   recentReceivedAtMost10Minutes:fresh.length,
   overlappingSelectionsWithMultipleBookLabels:[...groups.values()].filter(x=>x.books.size>=2).length,
   overlappingSelectionsWithMultipleProviderLabels:[...groups.values()].filter(x=>x.upstreams.size>=2).length,
   independentUpstreamsCertified:false,
   warning:'Provider labels and book names do not establish independent upstream ownership; this is not cross-book execution certification.'
  },fresh.map(x=>x.provider));
 }
 // This is the ONLY optional upstream collector. It is off until both explicit source
 // permission and named permitted leagues exist. Exactly one schedule request per run.
 if(id==='score-scout'){
  const allowed=process.env.EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED==='true'&&
   (process.env.EDGEFORCE_OUTCOME_ALLOWED_SOURCES||'').split(',').map(x=>x.trim()).includes('espn-scoreboard');
  const leagueIds=(process.env.EDGEFORCE_AGENT_SCORE_FEEDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const leagues=ESPN_SCOREBOARD_FEEDS.filter(x=>leagueIds.includes(x.id)&&x.sportSlug&&x.leagueSlug).slice(0,16);
  if(!allowed||!leagues.length)return evidence('NO_LICENSE',0,{
   message:'No approved source retention, or no explicit leagues selected. Collector is disabled.'
  },[]);
  const chosen=leagues[Math.floor(now/3600000)%leagues.length];
  const result=await loadSchedule(easternDay(0),0,chosen.id);
  const health=result.feeds.find(x=>x.id===chosen.id);
  if(!health?.ok)throw new Error('SCORE_SCOUT_UPSTREAM_UNAVAILABLE');
  const games=result.games.slice(0,16).map(g=>({
   eventId:g.id,sport:g.sport,home:g.home,away:g.away,
   status:g.status,homeScore:g.homeScore||null,awayScore:g.awayScore||null,
   gameStart:g.startTime,source:'espn-scoreboard',
   sourcePublishedAt:null
  }));
  return evidence(games.length?'EVIDENCE_FOUND':'NO_RECENT_EVIDENCE',games.length,{
   requestedLeague:chosen.label,day:easternDay(0),games,
   retrievedAt:new Date(now).toISOString(),sourcePublishedAt:null,
   independentlyVerified:false
  },['espn-scoreboard'],'AUTHORIZED_EXTERNAL_SCORE');
 }
 throw new Error('UNSUPPORTED_NETWORK_AGENT');
}
type Claimed={agentId:NetworkAgentId;leaseToken:string;cadenceMinutes:number};
export async function dispatchNetworkAgents(limit=2){
 const sql=db();if(!sql)throw new Error('NETWORK_AGENT_DATABASE_UNAVAILABLE');
 const max=Math.max(1,Math.min(2,Math.floor(limit)));
 const executed=[];
 for(let i=0;i<max;i++){
  const leaseToken=randomUUID();
  const scoutEnabled=process.env.EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED==='true';
  const claims=await sql<Claimed[]>`
   with candidate as (
    select agent_id from public.edgeforce_network_agents_v211
    where enabled=true and next_due_at<=clock_timestamp()
     and lease_until<=clock_timestamp()
     and (agent_id<>'score-scout' or ${scoutEnabled})
    order by next_due_at asc,agent_id asc
    for update skip locked limit 1
   )
   update public.edgeforce_network_agents_v211 a
   set lease_token=${leaseToken},lease_until=clock_timestamp()+interval '4 minutes',
    last_started_at=clock_timestamp()
   from candidate
   where a.agent_id=candidate.agent_id
   returning a.agent_id as "agentId",a.lease_token as "leaseToken",
    a.cadence_minutes as "cadenceMinutes"`;
  const lease=claims[0];if(!lease)break;
  let result:AgentEvidence,err:string|null=null;
  try{
   result=await collectNetworkAgent(lease.agentId);
  }catch(e){
   err=e instanceof Error?e.message.slice(0,110):'AGENT_COLLECTION_FAILED';
   result=evidence('ERROR',0,{errorCategory:'UPSTREAM_OR_DATABASE_UNAVAILABLE'},[]);
  }
  const finished=await sql.begin(async tx=>{
   const saved=await tx`
    update public.edgeforce_network_agents_v211
    set next_due_at=clock_timestamp()+
     (${err?Math.min(240,lease.cadenceMinutes*2):lease.cadenceMinutes}*interval '1 minute'),
     last_finished_at=clock_timestamp(),last_result=${result.status},
     completed_runs=completed_runs+1,
     consecutive_failures=case when ${err===null} then 0 else consecutive_failures+1 end,
     last_error=${err},lease_until='epoch',lease_token=null
    where agent_id=${lease.agentId} and lease_token=${lease.leaseToken}
     and lease_until>clock_timestamp()
    returning agent_id`;
   if(!saved.length)throw new Error('AGENT_LEASE_EXPIRED');
   await tx`
    insert into public.edgeforce_network_agent_observations_v211(
     agent_id,source_role,source_ids,result_status,event_count,payload,run_id)
    values(${lease.agentId},${result.sourceRole},
     ${tx.array(result.sources)},${result.status},${result.rowCount},
     ${tx.json(result.facts)},${lease.leaseToken})`;
   return true;
  });
  executed.push({agentId:lease.agentId,recorded:finished,
   status:result.status,rows:result.rowCount,sourceRole:result.sourceRole});
 }
 return {executed,executedCount:executed.length,
  selfHostedNetwork:true,externalAgentCalls:executed.filter(x=>x.sourceRole==='AUTHORIZED_EXTERNAL_SCORE').length,
  dataSourceRole:'FIRST_PARTY_DERIVED_DATABASE_WITH_AUTHORIZED_FEED_INPUTS'};
}
