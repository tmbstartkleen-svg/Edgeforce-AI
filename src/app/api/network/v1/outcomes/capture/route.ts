import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {ESPN_SCOREBOARD_FEEDS} from '@/lib/sportRegistry';
import {loadSchedule} from '@/lib/gameSchedule';
import {normalizeFinals} from '@/lib/sportsOutcomeHistory';

export const dynamic='force-dynamic';
const error=(status:string,code:number)=>Response.json({ok:false,status},{status:code,headers:networkHeaders});
const SOURCE='espn-scoreboard';
/** Operator-triggered at most ONE league/day scoreboard query, never cron. */
export async function POST(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 if(process.env.EDGEFORCE_OUTCOME_CAPTURE_ENABLED!=='true')return error('OUTCOME_CAPTURE_DISABLED',503);
 const permitted=(process.env.EDGEFORCE_OUTCOME_ALLOWED_SOURCES||'').split(',').map(x=>x.trim());
 if(!permitted.includes(SOURCE))return error('SOURCE_RETENTION_NOT_AUTHORIZED',403);
 const length=Number(request.headers.get('content-length')||0);
 if(length>180)return error('REQUEST_TOO_LARGE',413);
 let payload:unknown;
 try{const text=await request.text();if(text.length>180)throw Error('size');payload=JSON.parse(text)}
 catch{return error('INVALID_REQUEST',400)}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return error('INVALID_REQUEST',400);
 const {feedId,date}=payload as Record<string,unknown>;
 if(typeof feedId!=='string'||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))
  return error('INVALID_FEED_OR_DATE',400);
 const feed=ESPN_SCOREBOARD_FEEDS.find(x=>x.id===feedId&&x.sportSlug&&x.leagueSlug);
 const requested=Date.parse(date+'T00:00:00Z'),now=Date.now();
 if(!feed||!Number.isFinite(requested)||new Date(requested).toISOString().slice(0,10)!==date||
  requested>now||requested<now-14*86400000)
  return error('UNSUPPORTED_FEED_OR_DATE_RANGE',400);
 const sql=db();if(!sql)return error('DATABASE_NOT_CONFIGURED',503);
 try{
  const grant=await sql.begin(async tx=>{
   await tx`insert into public.edgeforce_sports_outcome_sync_v209(source,feed_id)
     values(${SOURCE},${feed.id}) on conflict do nothing`;
   const rows=await tx`update public.edgeforce_sports_outcome_sync_v209
     set next_allowed_at=clock_timestamp()+interval '10 minutes',
      attempted_batches=attempted_batches+1,last_attempt_at=clock_timestamp()
     where source=${SOURCE} and feed_id=${feed.id} and next_allowed_at<=clock_timestamp()
     returning next_allowed_at`;
   return rows.length?{ok:true as const}:{ok:false as const};
  });
  if(!grant.ok)return error('SHARED_SCORE_CAPTURE_COOLDOWN',429);
  const result=await loadSchedule(date,0,feed.id);
  const feedHealth=result.feeds.find(f=>f.id===feed.id);
  if(!feedHealth?.ok)return error('SCORE_SOURCE_UNAVAILABLE',503);
  const normalized=normalizeFinals(result.games,SOURCE,feed.label,Date.now());
  const saved=await sql.begin(async tx=>{
   let inserted=0;
   for(const item of normalized.games.slice(0,100)){
    const records=await tx`insert into public.edgeforce_sports_outcomes_v209(
     source,source_event_key,sport,league,home_name,away_name,
     scheduled_at,home_score,away_score,source_observed_at
    )values(${item.source},${item.sourceEventKey},${item.sport},${item.league},
      ${item.homeName},${item.awayName},${item.scheduledAt},
      ${item.homeScore},${item.awayScore},null)
    on conflict(source,source_event_key,home_score,away_score) do nothing returning id`;
    inserted+=records.length;
   }
   await tx`update public.edgeforce_sports_outcome_sync_v209
    set observed_final_games=observed_final_games+${normalized.games.length},
     inserted_revisions=inserted_revisions+${inserted}
    where source=${SOURCE} and feed_id=${feed.id}`;
   return inserted;
  });
  return Response.json({
   ok:true,network:'EdgeForce Sports Network',dataRole:'SINGLE_SOURCE_FINAL_SCORE_HISTORY',
   feed:feed.label,date,examined:normalized.examined,finalScoreObservations:normalized.games.length,
   rejected:normalized.rejected,newRevisions:saved,
   sourceTimestampAvailable:false,sourceCount:1,officiallyVerified:false,
   warning:'A scoreboard FINAL is a single provider observation. Collection time is not the provider publication time; no independent final-score consensus, player stats, or play-by-play was inferred.'
  },{headers:networkHeaders});
 }catch{return error('OUTCOME_STORAGE_OR_SOURCE_FAILED',503);}
}
