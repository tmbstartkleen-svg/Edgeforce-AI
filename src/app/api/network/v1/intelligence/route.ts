import {db} from '@/lib/db';
import {authorizeNetwork,networkHeaders} from '@/lib/firstPartySportsNetwork';
import {chroniclePast,chroniclePresent,chronicleFuture,
 type ChroniclePastRow,type ChronicleNowRow,type ChronicleFutureRow,type ChronicleEra} from '@/lib/sportsNetworkChronicle';

export const dynamic='force-dynamic';
const fail=(status:string,code:number)=>Response.json({ok:false,status,entries:[]},{status:code,headers:networkHeaders});
const stamp=(v:Date|string|null)=>v===null?null:new Date(v).toISOString();
type PastRow=Omit<ChroniclePastRow,'startTime'|'observedAt'> & {startTime:Date|string;observedAt:Date|string|null};
type NowRow=Omit<ChronicleNowRow,'startTime'|'sourceObservedAt'|'pulledAt'> & {startTime:Date|string;sourceObservedAt:Date|string|null;pulledAt:Date|string|null};
type FutureRow=Omit<ChronicleFutureRow,'startTime'|'createdAt'|'calibrationPeriodEnd'|'probability'|'ciLow'|'ciHigh'|'calibrationSample'|'calibrationError'|'brierScore'> & {
 startTime:Date|string;createdAt:Date|string;calibrationPeriodEnd:Date|string|null;
 probability:number|string;ciLow:number|string|null;ciHigh:number|string|null;
 calibrationSample:number|string|null;calibrationError:number|string|null;brierScore:number|string|null;
};
export async function GET(request:Request){
 const auth=authorizeNetwork(request);if(auth)return auth;
 const url=new URL(request.url);
 const era=url.searchParams.get('era');
 const sport=(url.searchParams.get('sport')||'').trim();
 if(!['past','present','future'].includes(era||'')||sport&&!/^[A-Za-z0-9 _-]{2,28}$/.test(sport))
  return fail('INVALID_ERA_OR_SPORT',400);
 const sql=db();if(!sql)return fail('DATABASE_NOT_CONFIGURED',503);
 const now=Date.now();
 try{
  if(era==='past'){
   // Archived bookmaker observations and ledger settlements are not official final game results.
   const rows=await sql<PastRow[]>`
    select e.id as "eventId",e.sport,e.league,
     e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
     ms.market_key as market,ms.selection_key as selection,ms.american_odds as "offeredOdds",
     ms.bookmaker,ms.provider,ms.pulled_at as "observedAt",
     exists(select 1 from bet_results br where br.event_id=e.id and br.settled_at is not null) as "hasSettlementEvidence",
     false as "gameResultConfirmed"
    from events e
    left join lateral (
     select market_key,selection_key,american_odds,bookmaker,provider,pulled_at
     from market_snapshots where event_id=e.id order by pulled_at desc limit 1
    ) ms on true
    where e.start_time<now() and e.start_time>=now()-interval '90 days'
     and (${sport}='' or lower(e.sport)=lower(${sport}))
    order by e.start_time desc limit 50
   `;
   const cleaned:ChroniclePastRow[]=rows.map(r=>({...r,startTime:stamp(r.startTime)||'',
    observedAt:stamp(r.observedAt),offeredOdds:r.offeredOdds===null?null:Number(r.offeredOdds)}));
   return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v1',...chroniclePast(cleaned,now)},{headers:networkHeaders});
  }
  if(era==='present'){
   // Near-term games are schedule entities; a market quote may or may not be attached.
   const rows=await sql<NowRow[]>`
    select e.id as "eventId",e.sport,e.league,
     e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
     ms.market_key as market,ms.selection_key as selection,ms.american_odds as odds,
     ms.bookmaker,ms.provider,
     nullif(ms.raw->>'sourceTimestamp','') as "sourceObservedAt",
     ms.pulled_at as "pulledAt"
    from events e
    left join lateral (
     select market_key,selection_key,american_odds,bookmaker,provider,raw,pulled_at
     from market_snapshots
     where event_id=e.id and pulled_at>now()-interval '30 minutes'
     order by pulled_at desc limit 1
    ) ms on true
    where e.start_time>=now()-interval '6 hours' and e.start_time<now()+interval '36 hours'
     and (${sport}='' or lower(e.sport)=lower(${sport}))
    order by e.start_time asc limit 50
   `;
   const cleaned:ChronicleNowRow[]=rows.map(r=>({...r,startTime:stamp(r.startTime)||'',
    sourceObservedAt:stamp(r.sourceObservedAt),pulledAt:stamp(r.pulledAt),
    odds:r.odds===null?null:Number(r.odds)}));
   return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v1',...chroniclePresent(cleaned,now)},{headers:networkHeaders});
  }
  const rows=await sql<FutureRow[]>`
   select mr.event_id as "eventId",e.sport,e.league,
    e.home_team_id as home,e.away_team_id as away,e.start_time as "startTime",
    mr.model_version as "modelVersion",mr.market_key as market,
    mr.selection_key as selection,mr.model_probability as probability,
    mr.run_count as runs,mr.simulation_ci_low as "ciLow",
    mr.simulation_ci_high as "ciHigh",mr.created_at as "createdAt",
    cm.sample_size as "calibrationSample",
    cm.calibration_error as "calibrationError",cm.brier_score as "brierScore",
    cm.period_end as "calibrationPeriodEnd"
   from model_runs mr
   join events e on e.id=mr.event_id
   left join lateral (
    select sample_size,calibration_error,brier_score,period_end
    from calibration_metrics
    where model_version=mr.model_version and sport=e.sport and market_key=mr.market_key
     and period_end<=current_date
    order by period_end desc,created_at desc limit 1
   ) cm on true
   where e.start_time>now() and e.start_time<now()+interval '7 days'
    and mr.created_at>now()-interval '7 days'
    and (${sport}='' or lower(e.sport)=lower(${sport}))
   order by mr.created_at desc limit 100
  `;
  const cleaned:ChronicleFutureRow[]=rows.map(r=>({...r,startTime:stamp(r.startTime)||'',
   createdAt:stamp(r.createdAt)||'',calibrationPeriodEnd:stamp(r.calibrationPeriodEnd),
   probability:Number(r.probability),ciLow:r.ciLow===null?null:Number(r.ciLow),
   ciHigh:r.ciHigh===null?null:Number(r.ciHigh),
   calibrationSample:r.calibrationSample===null?null:Number(r.calibrationSample),
   calibrationError:r.calibrationError===null?null:Number(r.calibrationError),
   brierScore:r.brierScore===null?null:Number(r.brierScore)}));
  return Response.json({ok:true,network:'EdgeForce Sports Network',version:'v1',...chronicleFuture(cleaned,now)},{headers:networkHeaders});
 }catch{
  return fail('NETWORK_RESEARCH_DATABASE_UNAVAILABLE',503);
 }
}
